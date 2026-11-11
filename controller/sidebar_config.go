package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// SidebarLink is one admin-defined shortcut shown in the sidebar group.
type SidebarLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// SidebarConfig drives the "Chat & Fun" sidebar group; editable from the admin console.
type SidebarConfig struct {
	// GroupTitle replaces the built-in group name (default: 聊天和娱乐).
	GroupTitle string `json:"group_title"`
	// ShowPlayground keeps the built-in /playground entry visible.
	ShowPlayground bool `json:"show_playground"`
	// FlatChatPresets lifts chat presets (e.g. AI 生图) out of the collapsible
	// "Chat" wrapper so they render as top-level entries in the group.
	FlatChatPresets bool `json:"flat_chat_presets"`
	// Links are extra shortcuts appended at the end of the group.
	Links []SidebarLink `json:"links"`
}

const sidebarConfigKey = "fork_setting.sidebar_config"

const sidebarMaxLinks = 20

func defaultSidebarConfig() SidebarConfig {
	return SidebarConfig{
		GroupTitle:      "聊天和娱乐",
		ShowPlayground:  false,
		FlatChatPresets: true,
		Links: []SidebarLink{
			{Name: "几猫 3A 大作", URL: "https://cat.774966.xyz/jm/"},
			{Name: "飞车 3D", URL: "https://cat.774966.xyz/qqfc/"},
			{Name: "运输船", URL: "https://cat.774966.xyz/cf/"},
			{Name: "鹈鹕骑单车", URL: "https://cat.774966.xyz/bike/"},
		},
	}
}

func loadSidebarConfig() SidebarConfig {
	cfg := defaultSidebarConfig()
	options, err := model.AllOption()
	if err != nil {
		return cfg
	}
	for _, opt := range options {
		if opt.Key != sidebarConfigKey || strings.TrimSpace(opt.Value) == "" {
			continue
		}
		var parsed SidebarConfig
		if err := common.UnmarshalJsonStr(opt.Value, &parsed); err != nil {
			return cfg
		}
		if strings.TrimSpace(parsed.GroupTitle) == "" {
			parsed.GroupTitle = cfg.GroupTitle
		}
		return parsed
	}
	return cfg
}

func normalizeSidebarLinks(links []SidebarLink) []SidebarLink {
	cleaned := make([]SidebarLink, 0, len(links))
	for _, link := range links {
		name := strings.TrimSpace(link.Name)
		url := strings.TrimSpace(link.URL)
		if name == "" || url == "" {
			continue
		}
		if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			continue
		}
		cleaned = append(cleaned, SidebarLink{Name: name, URL: url})
		if len(cleaned) >= sidebarMaxLinks {
			break
		}
	}
	return cleaned
}

// GetSidebarConfigPublic exposes the sidebar layout so the client can render it.
func GetSidebarConfigPublic(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": loadSidebarConfig()})
}

// GetSidebarConfigAdmin returns the sidebar config for editing.
func GetSidebarConfigAdmin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": loadSidebarConfig()})
}

// UpdateSidebarConfig saves the sidebar config (admin).
func UpdateSidebarConfig(c *gin.Context) {
	var req SidebarConfig
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	req.GroupTitle = strings.TrimSpace(req.GroupTitle)
	if req.GroupTitle == "" {
		req.GroupTitle = defaultSidebarConfig().GroupTitle
	}
	req.Links = normalizeSidebarLinks(req.Links)

	raw, err := common.Marshal(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(sidebarConfigKey, string(raw)); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, 0, "site.sidebar_config", map[string]interface{}{
		"links": len(req.Links),
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
