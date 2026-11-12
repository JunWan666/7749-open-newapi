package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// KeyQuotaKeyView 是后台展示用的单个 key 信息（key 已脱敏）。
type KeyQuotaKeyView struct {
	Index      int     `json:"index"`
	Masked     string  `json:"masked"`
	Status     int     `json:"status"`
	Reason     string  `json:"reason"`
	DisabledAt int64   `json:"disabled_at"`
	Balance    float64 `json:"balance"`
	BalanceAt  int64   `json:"balance_at"`
	BalanceErr string  `json:"balance_error"`
}

// KeyQuotaChannelView 是一个多 key 渠道的概览。
type KeyQuotaChannelView struct {
	Id                     int               `json:"id"`
	Name                   string            `json:"name"`
	Status                 int               `json:"status"`
	Enabled                bool              `json:"enabled"`
	TotalKeys              int               `json:"total_keys"`
	UsableKeys             int               `json:"usable_keys"`
	AutoDisabledKeys       int               `json:"auto_disabled_keys"`
	ManualDisabledKeys     int               `json:"manual_disabled_keys"`
	DailyQuotaPerKey       int               `json:"daily_quota_per_key"`
	CostPerCall            int               `json:"cost_per_call"`
	EstimatedRemainingCall int64             `json:"estimated_remaining_calls"`
	BalanceSum             float64           `json:"balance_sum"`
	BalanceUpdatedAt       int64             `json:"balance_updated_at"`
	ProbeEnabled           bool              `json:"probe_enabled"`
	ProbeIntervalMinutes   int               `json:"probe_interval_minutes"`
	Keys                   []KeyQuotaKeyView `json:"keys"`
}

// maskKey 只保留前 4 位与后 4 位，避免后台泄露完整密钥。
func maskKey(key string) string {
	trimmed := strings.TrimSpace(key)
	if len(trimmed) <= 8 {
		return "****"
	}
	return trimmed[:4] + "****" + trimmed[len(trimmed)-4:]
}

func buildKeyQuotaKeyViews(channel *model.Channel) []KeyQuotaKeyView {
	keys := channel.GetKeys()
	statusList := channel.ChannelInfo.MultiKeyStatusList
	reasons := channel.ChannelInfo.MultiKeyDisabledReason
	times := channel.ChannelInfo.MultiKeyDisabledTime
	balances := channel.ChannelInfo.KeyBalances

	views := make([]KeyQuotaKeyView, 0, len(keys))
	for idx := range keys {
		status := common.ChannelStatusEnabled
		if s, ok := statusList[idx]; ok {
			status = s
		}
		view := KeyQuotaKeyView{
			Index:      idx,
			Masked:     maskKey(keys[idx]),
			Status:     status,
			Reason:     reasons[idx],
			DisabledAt: times[idx],
		}
		if info, ok := balances[idx]; ok {
			view.Balance = info.Balance
			view.BalanceAt = info.UpdatedAt
			view.BalanceErr = info.Error
		}
		views = append(views, view)
	}
	return views
}

func buildKeyQuotaView(channel *model.Channel) KeyQuotaChannelView {
	guard := channel.ChannelInfo.KeyQuotaGuard
	keys := channel.GetKeys()
	statusList := channel.ChannelInfo.MultiKeyStatusList

	view := KeyQuotaChannelView{
		Id:        channel.Id,
		Name:      channel.Name,
		Status:    channel.Status,
		TotalKeys: len(keys),
		Keys:      buildKeyQuotaKeyViews(channel),
	}
	for _, status := range statusList {
		switch status {
		case common.ChannelStatusAutoDisabled:
			view.AutoDisabledKeys++
		case common.ChannelStatusManuallyDisabled:
			view.ManualDisabledKeys++
		}
	}
	view.UsableKeys = view.TotalKeys - view.AutoDisabledKeys - view.ManualDisabledKeys

	// 剩余可调用次数 ≈ 可用 key 数 × (每号日额度 / 每次消耗)
	if guard != nil {
		view.Enabled = guard.Enabled
		view.DailyQuotaPerKey = guard.DailyQuotaPerKey
		view.CostPerCall = guard.CostPerCall
		if guard.DailyQuotaPerKey > 0 && guard.CostPerCall > 0 {
			perKey := guard.DailyQuotaPerKey / guard.CostPerCall
			view.EstimatedRemainingCall = int64(view.UsableKeys) * int64(perKey)
		}
	}
	if probe := channel.ChannelInfo.KeyBalanceProbe; probe != nil {
		view.ProbeEnabled = probe.Enabled
		view.ProbeIntervalMinutes = probe.IntervalMinutes
	}
	for _, info := range channel.ChannelInfo.KeyBalances {
		view.BalanceSum += info.Balance
		if info.UpdatedAt > view.BalanceUpdatedAt {
			view.BalanceUpdatedAt = info.UpdatedAt
		}
	}
	return view
}

// GetKeyQuotaOverview 返回所有多 key 渠道的概览（key 明细走分页接口）。
func GetKeyQuotaOverview(c *gin.Context) {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	views := make([]KeyQuotaChannelView, 0, len(channels))
	for _, channel := range channels {
		// 只显示「在渠道编辑里开启了额度保护」的多 key 渠道
		if !channel.ChannelInfo.IsMultiKey {
			continue
		}
		guard := channel.ChannelInfo.KeyQuotaGuard
		if guard == nil || !guard.Enabled {
			continue
		}
		view := buildKeyQuotaView(channel)
		view.Keys = nil
		views = append(views, view)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": views})
}

// GetKeyQuotaKeys 分页返回某渠道的 key 列表，支持状态筛选与脱敏关键字搜索。
func GetKeyQuotaKeys(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil || channel == nil {
		common.ApiErrorI18n(c, i18n.MsgChannelNotExists)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	statusFilter := strings.TrimSpace(c.DefaultQuery("status", "all"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	all := buildKeyQuotaKeyViews(channel)
	filtered := make([]KeyQuotaKeyView, 0, len(all))
	for _, item := range all {
		switch statusFilter {
		case "available":
			if item.Status != common.ChannelStatusEnabled {
				continue
			}
		case "auto":
			if item.Status != common.ChannelStatusAutoDisabled {
				continue
			}
		case "manual":
			if item.Status != common.ChannelStatusManuallyDisabled {
				continue
			}
		}
		if keyword != "" && !strings.Contains(strings.ToLower(item.Masked), strings.ToLower(keyword)) {
			continue
		}
		filtered = append(filtered, item)
	}

	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	summary := buildKeyQuotaView(channel)
	summary.Keys = nil
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":     filtered[start:end],
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"summary":   summary,
		},
	})
}

// UpdateKeyQuotaGuard 开启/关闭某个渠道的 key 额度保护（root）。
func UpdateKeyQuotaGuard(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req struct {
		Enabled          bool `json:"enabled"`
		DailyQuotaPerKey int  `json:"daily_quota_per_key"`
		CostPerCall      int  `json:"cost_per_call"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil || channel == nil {
		common.ApiErrorI18n(c, i18n.MsgChannelNotExists)
		return
	}
	if !channel.ChannelInfo.IsMultiKey {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该渠道不是多 key 渠道，无法开启 key 额度保护",
		})
		return
	}
	dailyQuota := req.DailyQuotaPerKey
	if dailyQuota <= 0 {
		dailyQuota = 250
	}
	costPerCall := req.CostPerCall
	if costPerCall <= 0 {
		costPerCall = 2
	}
	channel.ChannelInfo.KeyQuotaGuard = &model.KeyQuotaGuard{
		Enabled:          req.Enabled,
		DailyQuotaPerKey: dailyQuota,
		CostPerCall:      costPerCall,
	}
	if err := channel.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.CacheUpdateChannel(channel)
	recordManageAuditFor(c, 0, "channel.key_quota_guard", map[string]interface{}{
		"channel_id": channelId,
		"enabled":    req.Enabled,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// UpdateKeyBalanceProbe 配置自动刷新余额的开关与间隔（root）。
func UpdateKeyBalanceProbe(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req struct {
		Enabled         bool   `json:"enabled"`
		IntervalMinutes int    `json:"interval_minutes"`
		URL             string `json:"url"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil || channel == nil {
		common.ApiErrorI18n(c, i18n.MsgChannelNotExists)
		return
	}
	interval := req.IntervalMinutes
	if interval < 5 {
		interval = 5
	}
	channel.ChannelInfo.KeyBalanceProbe = &model.KeyBalanceProbe{
		Enabled:         req.Enabled,
		URL:             strings.TrimSpace(req.URL),
		IntervalMinutes: interval,
	}
	if err := channel.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.CacheUpdateChannel(channel)
	recordManageAuditFor(c, 0, "channel.key_balance_probe", map[string]interface{}{
		"channel_id":       channelId,
		"enabled":          req.Enabled,
		"interval_minutes": interval,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// ProbeKeyBalances 立即查询余额；body 带 index 时只查单个 key。
func ProbeKeyBalances(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req struct {
		Index *int `json:"index"`
	}
	_ = common.DecodeJson(c.Request.Body, &req)

	channel, err := model.GetChannelById(channelId, true)
	if err != nil || channel == nil {
		common.ApiErrorI18n(c, i18n.MsgChannelNotExists)
		return
	}
	var only []int
	if req.Index != nil {
		only = []int{*req.Index}
	}
	probed, probeErr := service.ProbeChannelBalances(channel, only)
	if probeErr != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": probeErr.Error()})
		return
	}
	if err := channel.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.CacheUpdateChannel(channel)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("已查询 %d 个 key 的余额", probed),
	})
}

// ResetKeyQuotaGuardNow 立即把某渠道被自动禁用的 key 恢复（管理员手动救急）。
func ResetKeyQuotaGuardNow(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil || channel == nil {
		common.ApiErrorI18n(c, i18n.MsgChannelNotExists)
		return
	}
	guard := channel.ChannelInfo.KeyQuotaGuard
	if guard == nil || !guard.Enabled {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "该渠道未开启 key 额度保护"})
		return
	}
	restored := 0
	for idx, status := range channel.ChannelInfo.MultiKeyStatusList {
		if status != common.ChannelStatusAutoDisabled {
			continue
		}
		delete(channel.ChannelInfo.MultiKeyStatusList, idx)
		delete(channel.ChannelInfo.MultiKeyDisabledReason, idx)
		delete(channel.ChannelInfo.MultiKeyDisabledTime, idx)
		restored++
	}
	if restored > 0 {
		if channel.Status == common.ChannelStatusAutoDisabled {
			channel.Status = common.ChannelStatusEnabled
		}
		if err := channel.Update(); err != nil {
			common.ApiError(c, err)
			return
		}
		model.CacheUpdateChannel(channel)
	}
	recordManageAuditFor(c, 0, "channel.key_quota_reset", map[string]interface{}{
		"channel_id": channelId,
		"restored":   restored,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("已恢复 %d 个 key", restored),
	})
}
