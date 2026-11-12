package model

import (
	"time"
)

// GetChannelTodayCalls 返回某渠道今日（本地 0 点起）的调用次数。
// 数据来自 quota_data 聚合表的 count 字段，用于估算 key 池剩余可调用量。
func GetChannelTodayCalls(channelId int) int64 {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	var total int64
	DB.Table("quota_data").
		Select("coalesce(sum(count), 0)").
		Where("channel_id = ? AND created_at >= ?", channelId, startOfDay).
		Scan(&total)
	return total
}
