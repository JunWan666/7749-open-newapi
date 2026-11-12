package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	defaultBalanceProbeURL = "https://modelscope.ai/openapi/v1/magicubes/balance"
	// 串行探测间隔：上游余额接口有速率限制，并发会被 429
	balanceProbeDelay = 350 * time.Millisecond
	balanceProbeTick  = time.Minute
)

var balanceHTTPClient = &http.Client{Timeout: 20 * time.Second}

// ProbeChannelBalances 串行查询一个渠道的每个 key 余额，写回 channel_info。
//
//   - onlyIndexes 非空时只查询指定的 key
//   - 探测失败会记录 error 但不清空已有余额（避免抖动导致误判）
//   - guard 开启时，余额为 0 的 key 会被自动熔断；余额恢复的 key 自动放回
func ProbeChannelBalances(channel *model.Channel, onlyIndexes []int) (probed int, err error) {
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return 0, errors.New("该渠道没有 key")
	}
	url := defaultBalanceProbeURL
	if channel.ChannelInfo.KeyBalanceProbe != nil && strings.TrimSpace(channel.ChannelInfo.KeyBalanceProbe.URL) != "" {
		url = strings.TrimSpace(channel.ChannelInfo.KeyBalanceProbe.URL)
	}
	if channel.ChannelInfo.KeyBalances == nil {
		channel.ChannelInfo.KeyBalances = make(map[int]model.KeyBalanceInfo)
	}
	guard := channel.ChannelInfo.KeyQuotaGuard
	guardOn := guard != nil && guard.Enabled

	only := make(map[int]struct{}, len(onlyIndexes))
	for _, idx := range onlyIndexes {
		only[idx] = struct{}{}
	}

	for idx, key := range keys {
		if len(only) > 0 {
			if _, ok := only[idx]; !ok {
				continue
			}
		}
		info := model.KeyBalanceInfo{UpdatedAt: common.GetTimestamp()}
		balance, probeErr := fetchKeyBalance(url, key)
		if probeErr != nil {
			info.Error = probeErr.Error()
			if prev, ok := channel.ChannelInfo.KeyBalances[idx]; ok {
				info.Balance = prev.Balance
			}
		} else {
			info.Balance = balance
		}
		channel.ChannelInfo.KeyBalances[idx] = info
		probed++

		if guardOn && probeErr == nil {
			if syncKeyStatusByBalance(channel, idx, balance) {
				common.SysLog(fmt.Sprintf("key-quota: 渠道 #%d 的 key[%d] 余额=%.2f，已同步池状态", channel.Id, idx, balance))
			}
		}
		time.Sleep(balanceProbeDelay)
	}
	return probed, nil
}

// syncKeyStatusByBalance 依据余额同步 key 状态，返回是否发生变化。
func syncKeyStatusByBalance(channel *model.Channel, keyIndex int, balance float64) bool {
	if channel.ChannelInfo.MultiKeyStatusList == nil {
		channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
	}
	current, has := channel.ChannelInfo.MultiKeyStatusList[keyIndex]
	status := common.ChannelStatusEnabled
	if has {
		status = current
	}
	if balance <= 0 {
		if status == common.ChannelStatusAutoDisabled {
			return false
		}
		channel.ChannelInfo.MultiKeyStatusList[keyIndex] = common.ChannelStatusAutoDisabled
		if channel.ChannelInfo.MultiKeyDisabledReason == nil {
			channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime == nil {
			channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		}
		channel.ChannelInfo.MultiKeyDisabledReason[keyIndex] = "[key-quota] 余额为 0"
		channel.ChannelInfo.MultiKeyDisabledTime[keyIndex] = common.GetTimestamp()
		return true
	}
	// 余额 > 0：只恢复「哨兵自动熔断」的 key，手动禁用的不动
	if status == common.ChannelStatusAutoDisabled {
		delete(channel.ChannelInfo.MultiKeyStatusList, keyIndex)
		delete(channel.ChannelInfo.MultiKeyDisabledReason, keyIndex)
		delete(channel.ChannelInfo.MultiKeyDisabledTime, keyIndex)
		return true
	}
	return false
}

func fetchKeyBalance(url string, key string) (float64, error) {
	req, reqErr := http.NewRequest(http.MethodGet, url, nil)
	if reqErr != nil {
		return 0, reqErr
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(key))
	req.Header.Set("User-Agent", "new-api-key-balance/1.0")
	resp, err := balanceHTTPClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return 0, errors.New("返回不是合法 JSON")
	}
	data, _ := payload["data"].(map[string]interface{})
	if data == nil {
		return 0, errors.New("返回缺少 data 字段")
	}
	switch value := data["available_balance"].(type) {
	case float64:
		return value, nil
	case string:
		parsed, parseErr := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if parseErr != nil {
			return 0, errors.New("余额字段无法解析")
		}
		return parsed, nil
	}
	return 0, errors.New("返回缺少 available_balance 字段")
}

// StartKeyBalanceProbeScheduler 每分钟检查一次，按各渠道配置的间隔刷新余额。
func StartKeyBalanceProbeScheduler() {
	go func() {
		for range time.Tick(balanceProbeTick) {
			runDueBalanceProbes()
		}
	}()
	common.SysLog("key-quota: 余额自动刷新任务已启动（按渠道配置的间隔执行）")
}

func runDueBalanceProbes() {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return
	}
	now := common.GetTimestamp()
	for _, channel := range channels {
		cfg := channel.ChannelInfo.KeyBalanceProbe
		if cfg == nil || !cfg.Enabled {
			continue
		}
		interval := cfg.IntervalMinutes
		if interval <= 0 {
			interval = 30
		}
		last := int64(0)
		for _, info := range channel.ChannelInfo.KeyBalances {
			if info.UpdatedAt > last {
				last = info.UpdatedAt
			}
		}
		if now-last < int64(interval*60) {
			continue
		}
		target := channel
		go func(ch *model.Channel) {
			if _, probeErr := ProbeChannelBalances(ch, nil); probeErr != nil {
				common.SysLog(fmt.Sprintf("key-quota: 渠道 #%d 余额刷新失败: %s", ch.Id, probeErr.Error()))
				return
			}
			if updateErr := ch.Update(); updateErr != nil {
				common.SysLog(fmt.Sprintf("key-quota: 渠道 #%d 余额写回失败: %s", ch.Id, updateErr.Error()))
				return
			}
			model.CacheUpdateChannel(ch)
		}(target)
	}
}
