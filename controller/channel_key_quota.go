package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// KeyQuotaKeyView 是后台展示用的单个 key 信息（key 已脱敏）。
type KeyQuotaKeyView struct {
	Index      int    `json:"index"`
	Masked     string `json:"masked"`
	Status     int    `json:"status"`
	Reason     string `json:"reason"`
	DisabledAt int64  `json:"disabled_at"`
}

// KeyQuotaChannelView 是一个开启额度保护的渠道概览。
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

func buildKeyQuotaView(channel *model.Channel) KeyQuotaChannelView {
	guard := channel.ChannelInfo.KeyQuotaGuard
	keys := channel.GetKeys()
	statusList := channel.ChannelInfo.MultiKeyStatusList
	reasons := channel.ChannelInfo.MultiKeyDisabledReason
	times := channel.ChannelInfo.MultiKeyDisabledTime

	view := KeyQuotaChannelView{
		Id:        channel.Id,
		Name:      channel.Name,
		Status:    channel.Status,
		TotalKeys: len(keys),
		Keys:      make([]KeyQuotaKeyView, 0, len(keys)),
	}
	if guard != nil {
		view.Enabled = guard.Enabled
		view.DailyQuotaPerKey = guard.DailyQuotaPerKey
		view.CostPerCall = guard.CostPerCall
	}

	for idx := range keys {
		status := common.ChannelStatusEnabled
		if s, ok := statusList[idx]; ok {
			status = s
		}
		switch status {
		case common.ChannelStatusAutoDisabled:
			view.AutoDisabledKeys++
		case common.ChannelStatusManuallyDisabled:
			view.ManualDisabledKeys++
		}
		view.Keys = append(view.Keys, KeyQuotaKeyView{
			Index:      idx,
			Masked:     maskKey(keys[idx]),
			Status:     status,
			Reason:     reasons[idx],
			DisabledAt: times[idx],
		})
	}
	view.UsableKeys = view.TotalKeys - view.AutoDisabledKeys - view.ManualDisabledKeys

	// 剩余可调用次数 ≈ 可用 key 数 × (每号日额度 / 每次消耗)
	if guard != nil && guard.DailyQuotaPerKey > 0 && guard.CostPerCall > 0 {
		perKey := guard.DailyQuotaPerKey / guard.CostPerCall
		view.EstimatedRemainingCall = int64(view.UsableKeys) * int64(perKey)
	}
	return view
}

// GetKeyQuotaOverview 返回所有开启 key 额度保护的渠道及其 key 状态（管理员）。
func GetKeyQuotaOverview(c *gin.Context) {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	views := make([]KeyQuotaChannelView, 0, len(channels))
	for _, channel := range channels {
		guard := channel.ChannelInfo.KeyQuotaGuard
		if guard == nil || !guard.Enabled {
			continue
		}
		if !channel.ChannelInfo.IsMultiKey {
			continue
		}
		views = append(views, buildKeyQuotaView(channel))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": views})
}

type keyQuotaUpdateRequest struct {
	Enabled          bool `json:"enabled"`
	DailyQuotaPerKey int  `json:"daily_quota_per_key"`
	CostPerCall      int  `json:"cost_per_call"`
}

// UpdateKeyQuotaGuard 开启/关闭某个渠道的 key 额度保护（root）。
func UpdateKeyQuotaGuard(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req keyQuotaUpdateRequest
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
