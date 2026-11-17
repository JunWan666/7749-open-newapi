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
	RuleLabel string `json:"rule_label"`
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

// GetUserModelLimitConfig 返回限额配置、可选渠道/模型和今日用量。
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"config":   cfg,
			"channels": options,
			"usage":    buildUserModelLimitUsage(cfg),
		},
	})
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

func buildUserModelLimitUsage(cfg service.UserModelLimitConfig) []UserModelLimitUsage {
	result := make([]UserModelLimitUsage, 0, len(cfg.Rules)*5)
	if !cfg.Enabled {
		return result
	}
	start := service.TodayStartUnix()
	for index, rule := range cfg.Rules {
		if rule.DailyCalls <= 0 {
			continue
		}
		label := rule.Model
		query := model.DB.Table("quota_data").
			Select("user_id, username, coalesce(sum(count), 0) as calls").
			Where("created_at >= ?", start)
		if rule.Model != "" {
			query = query.Where("model_name = ?", rule.Model)
		} else if rule.ChannelId > 0 {
			query = query.Where("channel_id = ?", rule.ChannelId)
			label = "渠道 #" + strconv.Itoa(rule.ChannelId)
		} else {
			continue
		}
		var rows []struct {
			UserId   int    `gorm:"column:user_id"`
			Username string `gorm:"column:username"`
			Calls    int64  `gorm:"column:calls"`
		}
		if err := query.Group("user_id, username").Order("calls DESC").Limit(20).Scan(&rows).Error; err != nil {
			continue
		}
		for _, row := range rows {
			username := row.Username
			if username == "" {
				username = "#" + strconv.Itoa(row.UserId)
			}
			result = append(result, UserModelLimitUsage{
				RuleLabel: label,
				RuleIndex: index,
				UserId:    row.UserId,
				Username:  username,
				Calls:     row.Calls,
				Limit:     rule.DailyCalls,
			})
		}
	}
	return result
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
