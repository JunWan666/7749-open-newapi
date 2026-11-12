package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// quotaKeywords 判定「key 额度耗尽」的响应关键字（小写包含匹配）。
var quotaKeywords = []string{
	"insufficient balance",
	"insufficient_quota",
	"insufficient quota",
	"quota exceeded",
	"quota exhausted",
	"exceeded your current quota",
	"余额不足",
	"额度不足",
	"额度已用完",
}

const keyQuotaGuardReason = "[key-quota] 额度耗尽，自动移出号池"

// GuardMultiKeyQuota 处理多 key 渠道的「按 key 熔断」。
//
// 仅对开启了 channel_info.key_quota_guard 的渠道生效：命中 429 + 额度类关键字时，
// 只禁用当前请求使用的那个 key，其余 key 继续服务；其他渠道完全不受影响。
func GuardMultiKeyQuota(channelError types.ChannelError, err *types.NewAPIError) bool {
	if err == nil || !channelError.IsMultiKey {
		return false
	}
	if err.StatusCode != 429 {
		return false
	}
	channel, getErr := model.GetChannelById(channelError.ChannelId, true)
	if getErr != nil || channel == nil {
		return false
	}
	guard := channel.ChannelInfo.KeyQuotaGuard
	if guard == nil || !guard.Enabled {
		return false
	}
	if !matchQuotaKeyword(err.Error()) {
		return false
	}
	if ok := model.UpdateChannelStatus(channelError.ChannelId, channelError.UsingKey, common.ChannelStatusAutoDisabled, keyQuotaGuardReason); ok {
		common.SysLog(fmt.Sprintf("key-quota: 渠道 #%d 已禁用 1 个耗尽额度的 key（其余 key 继续服务）", channelError.ChannelId))
	}
	return true
}

func matchQuotaKeyword(message string) bool {
	lower := strings.ToLower(message)
	for _, keyword := range quotaKeywords {
		if strings.Contains(lower, keyword) {
			return true
		}
	}
	return false
}

// ResetKeyQuotaGuards 把所有开启 key_quota_guard 的渠道中「被自动禁用的 key」放回号池。
// 站长手动禁用的 key（ChannelStatusManuallyDisabled）保持不动。
func ResetKeyQuotaGuards() (channelCount int, keyCount int) {
	all, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.SysLog("key-quota: 每日恢复读取渠道失败: " + err.Error())
		return 0, 0
	}
	for _, channel := range all {
		guard := channel.ChannelInfo.KeyQuotaGuard
		if guard == nil || !guard.Enabled {
			continue
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
		if restored == 0 {
			continue
		}
		if channel.Status == common.ChannelStatusAutoDisabled {
			channel.Status = common.ChannelStatusEnabled
		}
		if updateErr := channel.Update(); updateErr != nil {
			common.SysLog(fmt.Sprintf("key-quota: 渠道 #%d 每日恢复失败: %s", channel.Id, updateErr.Error()))
			continue
		}
		model.CacheUpdateChannel(channel)
		channelCount++
		keyCount += restored
		common.SysLog(fmt.Sprintf("key-quota: 渠道 #%d 每日恢复 %d 个 key", channel.Id, restored))
	}
	if channelCount > 0 {
		common.SysLog(fmt.Sprintf("key-quota: 每日恢复完成，%d 个渠道共 %d 个 key 回到号池", channelCount, keyCount))
	}
	return channelCount, keyCount
}

// StartKeyQuotaGuardScheduler 每天 00:05 触发一次恢复（进程内定时，不依赖外部 cron）。
func StartKeyQuotaGuardScheduler() {
	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), 0, 5, 0, 0, now.Location())
			if !next.After(now) {
				next = next.AddDate(0, 0, 1)
			}
			time.Sleep(time.Until(next))
			ResetKeyQuotaGuards()
		}
	}()
	common.SysLog("key-quota: 每日 00:05 自动恢复任务已启动")
}
