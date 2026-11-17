package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// UserModelLimitRule 是一条「用户 × 模型/渠道」的每日调用上限。
type UserModelLimitRule struct {
	// ChannelId > 0 且 Model 为空时表示整个渠道；Model 非空表示指定模型。
	ChannelId  int    `json:"channel_id"`
	Model      string `json:"model"`
	DailyCalls int    `json:"daily_calls"`
}

// UserModelLimitConfig 控制单用户对模型/渠道的每日调用次数限制。
type UserModelLimitConfig struct {
	Enabled     bool                 `json:"enabled"`
	Rules       []UserModelLimitRule `json:"rules"`
	ExemptUsers []int                `json:"exempt_users"`
}

const userModelLimitOptionKey = "fork_setting.user_model_daily_limit"

// DefaultUserModelLimitConfig 默认关闭，不影响任何现有行为。
func DefaultUserModelLimitConfig() UserModelLimitConfig {
	return UserModelLimitConfig{
		Enabled:     false,
		Rules:       []UserModelLimitRule{},
		ExemptUsers: []int{},
	}
}

// LoadUserModelLimitConfig 从 options 表读取配置。
func LoadUserModelLimitConfig() UserModelLimitConfig {
	cfg := DefaultUserModelLimitConfig()
	options, err := model.AllOption()
	if err != nil {
		return cfg
	}
	for _, opt := range options {
		if opt.Key != userModelLimitOptionKey || strings.TrimSpace(opt.Value) == "" {
			continue
		}
		var parsed UserModelLimitConfig
		if err := common.UnmarshalJsonStr(opt.Value, &parsed); err != nil {
			return cfg
		}
		if parsed.Rules == nil {
			parsed.Rules = []UserModelLimitRule{}
		}
		if parsed.ExemptUsers == nil {
			parsed.ExemptUsers = []int{}
		}
		return parsed
	}
	return cfg
}

var (
	userLimitCfgMu    sync.Mutex
	userLimitCfgCache struct {
		expiresAt time.Time
		config    UserModelLimitConfig
	}
)

// cachedUserLimitConfig 每 30 秒刷新一次，避免每个请求都读全表 options。
func cachedUserLimitConfig() UserModelLimitConfig {
	userLimitCfgMu.Lock()
	defer userLimitCfgMu.Unlock()
	now := time.Now()
	if now.Before(userLimitCfgCache.expiresAt) {
		return userLimitCfgCache.config
	}
	cfg := LoadUserModelLimitConfig()
	userLimitCfgCache.config = cfg
	userLimitCfgCache.expiresAt = now.Add(30 * time.Second)
	return cfg
}

var (
	userLimitCountMu    sync.Mutex
	userLimitCountCache = map[string]struct {
		expiresAt time.Time
		value     int64
	}{}
)

// TodayStartUnix 返回今天 0 点的时间戳（本地时区），供额度/限额统计复用。
func TodayStartUnix() int64 {
	return todayStartUnix()
}

func todayStartUnix() int64 {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
}

// CountTodayCalls 统计某用户今日对指定模型（或指定渠道全部模型）的调用次数。
func CountTodayCalls(userId int, modelName string, channelId int, byChannel bool) int64 {
	cacheKey := fmt.Sprintf("%d|%s|%d|%t", userId, modelName, channelId, byChannel)
	userLimitCountMu.Lock()
	entry, ok := userLimitCountCache[cacheKey]
	if ok && time.Now().Before(entry.expiresAt) {
		value := entry.value
		userLimitCountMu.Unlock()
		return value
	}
	userLimitCountMu.Unlock()

	query := model.DB.Table("quota_data").
		Select("coalesce(sum(count), 0)").
		Where("user_id = ? AND created_at >= ?", userId, todayStartUnix())
	if byChannel {
		query = query.Where("channel_id = ?", channelId)
	} else {
		query = query.Where("model_name = ?", modelName)
	}
	var total int64
	if err := query.Scan(&total).Error; err != nil {
		return 0
	}

	userLimitCountMu.Lock()
	userLimitCountCache[cacheKey] = struct {
		expiresAt time.Time
		value     int64
	}{expiresAt: time.Now().Add(5 * time.Second), value: total}
	userLimitCountMu.Unlock()
	return total
}

// InvalidateUserLimitCountCache 清空计数缓存（改动配置或手动放行后调用）。
func InvalidateUserLimitCountCache() {
	userLimitCountMu.Lock()
	userLimitCountCache = map[string]struct {
		expiresAt time.Time
		value     int64
	}{}
	userLimitCountMu.Unlock()
}

// CheckUserModelDailyLimit 返回 nil 表示可以继续调用。
// 命中多条规则时取最严格的（次数最小）一条。
func CheckUserModelDailyLimit(userId, role int, modelName string, channelId int) error {
	cfg := cachedUserLimitConfig()
	if !cfg.Enabled || len(cfg.Rules) == 0 {
		return nil
	}
	// 管理员账号默认不受限
	if role >= 10 {
		return nil
	}
	for _, exempt := range cfg.ExemptUsers {
		if exempt == userId {
			return nil
		}
	}

	limit := 0
	byChannel := false
	for _, rule := range cfg.Rules {
		if rule.DailyCalls <= 0 {
			continue
		}
		if rule.Model != "" {
			if rule.Model != modelName {
				continue
			}
			if limit == 0 || rule.DailyCalls < limit {
				limit = rule.DailyCalls
				byChannel = false
			}
			continue
		}
		if rule.ChannelId <= 0 || rule.ChannelId != channelId {
			continue
		}
		if limit == 0 || rule.DailyCalls < limit {
			limit = rule.DailyCalls
			byChannel = true
		}
	}
	if limit == 0 {
		return nil
	}

	used := CountTodayCalls(userId, modelName, channelId, byChannel)
	if used < int64(limit) {
		return nil
	}
	label := modelName
	if byChannel {
		label = fmt.Sprintf("渠道 #%d 的模型", channelId)
	}
	return fmt.Errorf("%s 今日调用已达上限 %d 次，明日 00:00 自动重置", label, limit)
}
