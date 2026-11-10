package controller

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// NoticeBlock is one notice variant (pending review / restricted).
type NoticeBlock struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Steps       []string `json:"steps"`
	Footer      string   `json:"footer"`
	Note        string   `json:"note"`
}

// NoticeContact is someone users should ping in the group (admin / owner).
type NoticeContact struct {
	Name   string `json:"name"`
	Role   string `json:"role"`
	Avatar string `json:"avatar"`
}

// NoticeConfig drives the account-status banner dialog; editable from the admin console.
type NoticeConfig struct {
	Pending    NoticeBlock     `json:"pending"`
	Restricted NoticeBlock     `json:"restricted"`
	Contacts   []NoticeContact `json:"contacts"`
}

const noticeConfigKey = "fork_setting.notice_config"

func defaultNoticeConfig() NoticeConfig {
	return NoticeConfig{
		Pending: NoticeBlock{
			Title:       "账号待审核",
			Description: "账号已注册成功，需要管理员审核后才能调用模型。",
			Steps: []string{
				"扫描上方二维码加入微信群。",
				"把上面的用户名发群里，然后艾特管理员【IZ】或者群主，方便找到你的账号。",
				"还需要把群昵称改成「昵称-用户名」或「昵称-用户名-ID」，方便后续核查异常调用情况等问题。",
			},
			Footer: "审核通过后这条提示会自动消失，全部模型可用。",
			Note:   "",
		},
		Restricted: NoticeBlock{
			Title:       "账号受限",
			Description: "系统检测到该账号使用异常，已临时限制为仅可使用免费模型。",
			Steps: []string{
				"扫描上方二维码加入微信群。",
				"把上面的用户名发群里，然后艾特管理员【IZ】或者群主，方便找到你的账号。",
				"还需要把群昵称改成「昵称-用户名」或「昵称-用户名-ID」，方便后续核查异常调用情况等问题。",
			},
			Footer: "审核通过后这条提示会自动消失，全部模型可用。",
			Note:   "如果你认为这是误判，请向管理员说明接口用途，会重新核查。",
		},
		Contacts: []NoticeContact{
			{Name: "IZ", Role: "管理员", Avatar: "/api/contact-avatar/iz.jpg"},
			{Name: "群主", Role: "站长", Avatar: "/api/contact-avatar/owner.jpg"},
		},
	}
}

func loadNoticeConfig() NoticeConfig {
	cfg := defaultNoticeConfig()
	options, err := model.AllOption()
	if err != nil {
		return cfg
	}
	for _, opt := range options {
		if opt.Key != noticeConfigKey || strings.TrimSpace(opt.Value) == "" {
			continue
		}
		var parsed NoticeConfig
		if err := common.UnmarshalJsonStr(opt.Value, &parsed); err != nil {
			return cfg
		}
		// 兼容缺字段的情况
		if parsed.Pending.Title == "" {
			parsed.Pending = cfg.Pending
		}
		if parsed.Restricted.Title == "" {
			parsed.Restricted = cfg.Restricted
		}
		if len(parsed.Contacts) == 0 {
			parsed.Contacts = cfg.Contacts
		}
		return parsed
	}
	return cfg
}

// GetNoticeConfigPublic returns the notice config for the banner (no auth).
func GetNoticeConfigPublic(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": loadNoticeConfig()})
}

// GetNoticeConfigAdmin returns the notice config for editing.
func GetNoticeConfigAdmin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": loadNoticeConfig()})
}

// UpdateNoticeConfig saves the notice config (admin).
func UpdateNoticeConfig(c *gin.Context) {
	var req NoticeConfig
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(req.Contacts) > 4 {
		req.Contacts = req.Contacts[:4]
	}
	raw, err := common.Marshal(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(noticeConfigKey, string(raw)); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, 0, "site.notice_config", map[string]interface{}{})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// GetContactAvatar serves contact avatars stored under the data volume.
func GetContactAvatar(c *gin.Context) {
	name := filepath.Base(c.Param("file"))
	if name == "" || name == "." || name == ".." {
		c.Status(http.StatusNotFound)
		return
	}
	for _, dir := range []string{"/app/data/uploads/contacts", "./data/uploads/contacts"} {
		p := filepath.Join(dir, name)
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			c.Header("Cache-Control", "public, max-age=3600")
			c.File(p)
			return
		}
	}
	c.Status(http.StatusNotFound)
}
