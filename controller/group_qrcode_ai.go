package controller

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// 识别微信群二维码底部有效期文字所用的视觉模型（可在后台页面里改）。
const (
	qrVisionDefaultChannelId = 1
	qrVisionDefaultModel     = "nvidia/nemotron-3.5-super-vl-120b-a12b"
	qrVisionOptionKey        = "fork_setting.qr_vision"
	qrVisionPrompt           = "请逐字读出这张图片里所有可见的文字，原样输出。如果完全没有文字，只输出 NONE。"
)

// QrVisionConfig 是「二维码有效期识别」使用的渠道与模型。
type QrVisionConfig struct {
	ChannelId int    `json:"channel_id"`
	Model     string `json:"model"`
}

func defaultQrVisionConfig() QrVisionConfig {
	return QrVisionConfig{ChannelId: qrVisionDefaultChannelId, Model: qrVisionDefaultModel}
}

func loadQrVisionConfig() QrVisionConfig {
	cfg := defaultQrVisionConfig()
	options, err := model.AllOption()
	if err != nil {
		return cfg
	}
	for _, opt := range options {
		if opt.Key != qrVisionOptionKey || strings.TrimSpace(opt.Value) == "" {
			continue
		}
		var parsed QrVisionConfig
		if err := common.UnmarshalJsonStr(opt.Value, &parsed); err != nil {
			return cfg
		}
		if parsed.ChannelId > 0 {
			cfg.ChannelId = parsed.ChannelId
		}
		if strings.TrimSpace(parsed.Model) != "" {
			cfg.Model = strings.TrimSpace(parsed.Model)
		}
		return cfg
	}
	return cfg
}

// qrVisionModelOptions 把渠道里的站内模型名转成上游名（去掉渠道前缀）。
func qrVisionModelOptions(channel *model.Channel) []string {
	modelsList := strings.Split(channel.Models, ",")
	options := make([]string, 0, len(modelsList))
	for _, item := range modelsList {
		name := strings.TrimSpace(item)
		if name == "" {
			continue
		}
		if idx := strings.Index(name, "/"); idx >= 0 {
			name = name[idx+1:]
		}
		options = append(options, name)
	}
	return options
}

var (
	qrDateCN   = regexp.MustCompile(`(\d{1,2})\s*月\s*(\d{1,2})\s*日`)
	qrDateISO  = regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`)
	qrDateLong = regexp.MustCompile(`(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日`)
)

// UpdateGroupQrcodeMeta 只更新二维码有效期（不改图片）。
func UpdateGroupQrcodeMeta(c *gin.Context) {
	var req struct {
		ExpiresAt string `json:"expires_at"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	value := strings.TrimSpace(req.ExpiresAt)
	if value != "" {
		if _, err := time.Parse("2006-01-02", value); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "有效期格式应为 YYYY-MM-DD",
			})
			return
		}
	}
	meta := readGroupQrcodeMeta()
	meta.ExpiresAt = value
	writeGroupQrcodeMeta(meta)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": meta})
}

// DetectGroupQrcodeExpiry 用视觉模型读取已上传二维码图片上的有效期。
func DetectGroupQrcodeExpiry(c *gin.Context) {
	path, ok := findGroupQrcode()
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "还没有上传二维码图片"})
		return
	}
	text, err := recognizeQrText(path)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "识别失败：" + err.Error(),
		})
		return
	}
	expiresAt := extractExpiryDate(text)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"expires_at": expiresAt,
			"text":       strings.TrimSpace(text),
		},
	})
}

// recognizeQrText 使用当前保存的配置识别。
func recognizeQrText(path string) (string, error) {
	return recognizeQrTextWith(path, loadQrVisionConfig())
}

// recognizeQrTextWith 裁剪图片底部区域并放大，再交给指定视觉模型识别。
func recognizeQrTextWith(path string, visionCfg QrVisionConfig) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	src, _, err := image.Decode(file)
	if err != nil {
		return "", fmt.Errorf("图片解码失败")
	}
	// 有效期文字在图片底部；整图直接喂给模型会因缩放而糊掉
	cropped := cropAndScale(src, 0.86, 2)
	var buf bytes.Buffer
	if err := png.Encode(&buf, cropped); err != nil {
		return "", err
	}
	b64 := base64.StdEncoding.EncodeToString(buf.Bytes())

	channel, err := model.GetChannelById(visionCfg.ChannelId, true)
	if err != nil || channel == nil {
		return "", fmt.Errorf("找不到识别用的渠道")
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return "", fmt.Errorf("识别渠道没有可用 key")
	}
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		baseURL = "https://integrate.api.nvidia.com"
	}

	payload := map[string]interface{}{
		"model": visionCfg.Model,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": qrVisionPrompt},
					{"type": "image_url", "image_url": map[string]string{
						"url": "data:image/png;base64," + b64,
					}},
				},
			},
		},
		"max_tokens":  200,
		"temperature": 0,
	}
	raw, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, baseURL+"/v1/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(keys[0]))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("上游返回 HTTP %d", resp.StatusCode)
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || len(parsed.Choices) == 0 {
		return "", fmt.Errorf("识别返回为空")
	}
	return parsed.Choices[0].Message.Content, nil
}

// cropAndScale 取底部 ratio 区域并放大 scale 倍（最近邻，足够 OCR 使用）。
func cropAndScale(src image.Image, ratio float64, scale int) image.Image {
	bounds := src.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	top := int(float64(height) * ratio)
	partHeight := height - top
	if partHeight <= 0 {
		return src
	}
	dst := image.NewRGBA(image.Rect(0, 0, width*scale, partHeight*scale))
	for y := 0; y < partHeight; y++ {
		for x := 0; x < width; x++ {
			color := src.At(bounds.Min.X+x, bounds.Min.Y+top+y)
			for dy := 0; dy < scale; dy++ {
				for dx := 0; dx < scale; dx++ {
					dst.Set(x*scale+dx, y*scale+dy, color)
				}
			}
		}
	}
	return dst
}

// extractExpiryDate 从识别文本里提取有效期，返回 YYYY-MM-DD。
func extractExpiryDate(text string) string {
	now := time.Now()
	if match := qrDateISO.FindStringSubmatch(text); len(match) == 4 {
		return fmt.Sprintf("%s-%s-%s", match[1], match[2], match[3])
	}
	if match := qrDateLong.FindStringSubmatch(text); len(match) == 4 {
		return fmt.Sprintf("%s-%02d-%02d", match[1], atoiSafe(match[2]), atoiSafe(match[3]))
	}
	if match := qrDateCN.FindStringSubmatch(text); len(match) == 3 {
		date := time.Date(now.Year(), time.Month(atoiSafe(match[1])), atoiSafe(match[2]), 0, 0, 0, 0, now.Location())
		// 跨年处理：识别日期比今天早 60 天以上，认为指的是明年
		if date.Before(now.AddDate(0, 0, -60)) {
			date = date.AddDate(1, 0, 0)
		}
		return date.Format("2006-01-02")
	}
	return ""
}

func atoiSafe(value string) int {
	parsed, _ := strconv.Atoi(strings.TrimSpace(value))
	return parsed
}

// QrVisionChannelOption 是给前端下拉用的渠道与可用模型。
type QrVisionChannelOption struct {
	Id     int      `json:"id"`
	Name   string   `json:"name"`
	Models []string `json:"models"`
}

// GetQrVisionConfig 返回当前识别配置以及可选的渠道/模型。
func GetQrVisionConfig(c *gin.Context) {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	options := make([]QrVisionChannelOption, 0, len(channels))
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		options = append(options, QrVisionChannelOption{
			Id:     channel.Id,
			Name:   channel.Name,
			Models: qrVisionModelOptions(channel),
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"config":   loadQrVisionConfig(),
			"channels": options,
		},
	})
}

// UpdateQrVisionConfig 保存识别使用的渠道与模型。
func UpdateQrVisionConfig(c *gin.Context) {
	var req QrVisionConfig
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.ChannelId <= 0 || strings.TrimSpace(req.Model) == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请选择渠道与模型"})
		return
	}
	if channel, err := model.GetChannelById(req.ChannelId, true); err != nil || channel == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "渠道不存在"})
		return
	}
	req.Model = strings.TrimSpace(req.Model)
	raw, err := common.Marshal(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(qrVisionOptionKey, string(raw)); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, 0, "site.qr_vision", map[string]interface{}{
		"channel_id": req.ChannelId,
		"model":      req.Model,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// TestQrVisionConfig 用指定（或已保存）的配置试识别当前二维码，便于挑选模型。
func TestQrVisionConfig(c *gin.Context) {
	var req QrVisionConfig
	_ = common.DecodeJson(c.Request.Body, &req)
	cfg := loadQrVisionConfig()
	if req.ChannelId > 0 {
		cfg.ChannelId = req.ChannelId
	}
	if strings.TrimSpace(req.Model) != "" {
		cfg.Model = strings.TrimSpace(req.Model)
	}
	path, ok := findGroupQrcode()
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "还没有上传二维码图片"})
		return
	}
	start := time.Now()
	text, err := recognizeQrTextWith(path, cfg)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "识别失败：" + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"text":       strings.TrimSpace(text),
			"expires_at": extractExpiryDate(text),
			"elapsed_ms": time.Since(start).Milliseconds(),
			"model":      cfg.Model,
		},
	})
}
