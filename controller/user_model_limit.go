package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// UserModelLimitUsage 是某条规则下今日用量最高的用户。
type UserModelLimitUsage struct {
	RuleIndex int    `json:"rule_index"`
	UserId    int    `json:"user_id"`
	Username  string `json:"username"`
	Calls     int64  `json:"calls"`
	Limit     int    `json:"limit"`
}

type userModelLimitChannelOption struct {
	Id     int      `json:"id"`
	Name   string   `json:"name"`
	Models []string `json:"models"`
}

// exemptUserView 是豁免用户的展示信息（ID + 用户名）。
type exemptUserView struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
}

// GetUserModelLimitConfig 返回限额配置、可选渠道/模型和今日用量（分页）。
func GetUserModelLimitConfig(c *gin.Context) {
	cfg := service.LoadUserModelLimitConfig()

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	options := make([]userModelLimitChannelOption, 0, len(channels))
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		options = append(options, userModelLimitChannelOption{
			Id:     channel.Id,
			Name:   channel.Name,
			Models: splitChannelModels(channel.Models),
		})
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	channelNames := make(map[int]string, len(options))
	for _, option := range options {
		channelNames[option.Id] = option.Name
	}
	usage, total := buildUserModelLimitUsage(cfg, channelNames, page, pageSize)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"config":              cfg,
			"channels":            options,
			"exempt_users_detail": loadExemptUserViews(cfg.ExemptUsers),
			"usage_rules":         usage,
			"usage_total":         total,
			"usage_page":          page,
			"usage_page_size":     pageSize,
		},
	})
}

// loadExemptUserViews 把豁免用户 ID 转成「ID + 用户名」。
func loadExemptUserViews(ids []int) []exemptUserView {
	views := make([]exemptUserView, 0, len(ids))
	if len(ids) == 0 {
		return views
	}
	var rows []struct {
		Id       int    `gorm:"column:id"`
		Username string `gorm:"column:username"`
	}
	if err := model.DB.Table("users").Select("id, username").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		for _, id := range ids {
			views = append(views, exemptUserView{Id: id, Username: ""})
		}
		return views
	}
	nameById := make(map[int]string, len(rows))
	for _, row := range rows {
		nameById[row.Id] = row.Username
	}
	for _, id := range ids {
		views = append(views, exemptUserView{Id: id, Username: nameById[id]})
	}
	return views
}

func splitChannelModels(raw string) []string {
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, item := range parts {
		name := strings.TrimSpace(item)
		if name != "" {
			result = append(result, name)
		}
	}
	return result
}

// UserLimitRuleUsage 是一条规则（渠道/模型）下的今日用量，按规则分组展示。
type UserLimitRuleUsage struct {
	RuleIndex   int                   `json:"rule_index"`
	ChannelId   int                   `json:"channel_id"`
	ChannelName string                `json:"channel_name"`
	Model       string                `json:"model"`
	Limit       int                   `json:"limit"`
	UserCount   int                   `json:"user_count"`
	Users       []UserModelLimitUsage `json:"users"`
}

func buildUserModelLimitUsage(cfg service.UserModelLimitConfig, channelNames map[int]string, page, pageSize int) ([]UserLimitRuleUsage, int) {
	groups := make([]UserLimitRuleUsage, 0, len(cfg.Rules))
	if !cfg.Enabled {
		return groups, 0
	}
	dayStart := service.TodayStartUnix()
	for index, rule := range cfg.Rules {
		if rule.DailyCalls <= 0 {
			continue
		}
		base := model.DB.Table("quota_data").Where("created_at >= ?", dayStart)
		if rule.Model != "" {
			base = base.Where("model_name = ?", rule.Model)
		} else if rule.ChannelId > 0 {
			base = base.Where("channel_id = ?", rule.ChannelId)
		} else {
			continue
		}

		// 该规则今日有多少用户用过
		var userCount int64
		countQuery := model.DB.Table("quota_data").
			Select("count(distinct user_id)").
			Where("created_at >= ?", dayStart)
		if rule.Model != "" {
			countQuery = countQuery.Where("model_name = ?", rule.Model)
		} else {
			countQuery = countQuery.Where("channel_id = ?", rule.ChannelId)
		}
		countQuery.Scan(&userCount)

		var rows []struct {
			UserId   int    `gorm:"column:user_id"`
			Username string `gorm:"column:username"`
			Calls    int64  `gorm:"column:calls"`
		}
		base.Select("user_id, username, coalesce(sum(count), 0) as calls").
			Group("user_id, username").
			Order("calls DESC").
			Limit(30).
			Scan(&rows)

		users := make([]UserModelLimitUsage, 0, len(rows))
		for _, row := range rows {
			username := row.Username
			if username == "" {
				username = "#" + strconv.Itoa(row.UserId)
			}
			users = append(users, UserModelLimitUsage{
				RuleIndex: index,
				UserId:    row.UserId,
				Username:  username,
				Calls:     row.Calls,
				Limit:     rule.DailyCalls,
			})
		}

		groups = append(groups, UserLimitRuleUsage{
			RuleIndex:   index,
			ChannelId:   rule.ChannelId,
			ChannelName: channelNames[rule.ChannelId],
			Model:       rule.Model,
			Limit:       rule.DailyCalls,
			UserCount:   int(userCount),
			Users:       users,
		})
	}

	total := len(groups)
	pageStart := (page - 1) * pageSize
	if pageStart > total {
		pageStart = total
	}
	pageEnd := pageStart + pageSize
	if pageEnd > total {
		pageEnd = total
	}
	return groups[pageStart:pageEnd], total
}

// UpdateUserModelLimitConfig 保存限额配置（管理员）。
func UpdateUserModelLimitConfig(c *gin.Context) {
	var req service.UserModelLimitConfig
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	cleaned := make([]service.UserModelLimitRule, 0, len(req.Rules))
	for _, rule := range req.Rules {
		rule.Model = strings.TrimSpace(rule.Model)
		if rule.DailyCalls <= 0 {
			continue
		}
		if rule.Model == "" && rule.ChannelId <= 0 {
			continue
		}
		cleaned = append(cleaned, rule)
		if len(cleaned) >= 50 {
			break
		}
	}
	req.Rules = cleaned
	if req.ExemptUsers == nil {
		req.ExemptUsers = []int{}
	}
	if len(req.ExemptUsers) > 200 {
		req.ExemptUsers = req.ExemptUsers[:200]
	}

	raw, err := common.Marshal(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(userModelLimitOptionKey, string(raw)); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateUserLimitCountCache()
	recordManageAuditFor(c, 0, "site.user_model_limit", map[string]interface{}{
		"enabled": req.Enabled,
		"rules":   len(req.Rules),
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

const userModelLimitOptionKey = "fork_setting.user_model_daily_limit"
