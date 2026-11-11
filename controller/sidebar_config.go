package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// SidebarLink is one admin-defined shortcut inside a sidebar group.
type SidebarLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	// Embed shows the page inside the console (iframe) instead of a new tab.
	Embed bool `json:"embed"`
}

// SidebarGroup is one group of the console sidebar; editable from the admin console.
type SidebarGroup struct {
	Title string `json:"title"`
	// ShowPlayground keeps the built-in /playground entry in this group.
	ShowPlayground bool `json:"show_playground"`
	// ShowChatPresets includes the built-in chat presets (e.g. AI 生图).
	ShowChatPresets bool `json:"show_chat_presets"`
	// FlatChatPresets lifts chat presets out of the collapsible "Chat" wrapper
	// so they render as top-level entries in this group.
	FlatChatPresets bool `json:"flat_chat_presets"`
	// Links are admin-defined shortcuts appended to the group.
	Links []SidebarLink `json:"links"`
}

// SidebarConfig drives the custom sidebar groups; editable from the admin console.
type SidebarConfig struct {
	Groups []SidebarGroup `json:"groups"`
}

// rawSidebarConfig also understands the v1 single-group shape so existing
// deployments migrate without a manual DB edit.
type rawSidebarConfig struct {
	Groups          []SidebarGroup `json:"groups"`
	GroupTitle      string         `json:"group_title"`
	ShowPlayground  bool           `json:"show_playground"`
	FlatChatPresets bool           `json:"flat_chat_presets"`
	Links           []SidebarLink  `json:"links"`
}

const sidebarConfigKey = "fork_setting.sidebar_config"

const sidebarMaxLinks = 20

const sidebarMaxGroups = 4

func defaultSidebarConfig() SidebarConfig {
	return SidebarConfig{
		Groups: []SidebarGroup{
			{
				Title:           "生图和聊天",
				ShowPlayground:  false,
				ShowChatPresets: true,
				FlatChatPresets: true,
				Links:           []SidebarLink{},
			},
			{
				Title:           "娱乐",
				ShowPlayground:  false,
				ShowChatPresets: false,
				FlatChatPresets: false,
				Links: []SidebarLink{
					{Name: "几猫 3A 大作", URL: "https://cat.774966.xyz/jm/", Embed: true},
					{Name: "飞车 3D", URL: "https://cat.774966.xyz/qqfc/", Embed: true},
					{Name: "运输船", URL: "https://cat.774966.xyz/cf/", Embed: true},
					{Name: "鹈鹕骑单车", URL: "https://cat.774966.xyz/bike/", Embed: true},
				},
			},
		},
	}
}

func loadSidebarConfig() SidebarConfig {
	def := defaultSidebarConfig()
	options, err := model.AllOption()
	if err != nil {
		return def
	}
	for _, opt := range options {
		if opt.Key != sidebarConfigKey || strings.TrimSpace(opt.Value) == "" {
			continue
		}
		var parsed rawSidebarConfig
		if err := common.UnmarshalJsonStr(opt.Value, &parsed); err != nil {
			return def
		}
		if len(parsed.Groups) > 0 {
			return normalizeSidebarConfig(SidebarConfig{Groups: parsed.Groups})
		}
		// v1 → v2: split the single "聊天和娱乐" group into chat + shortcuts.
		legacy := SidebarGroup{
			Title:           strings.TrimSpace(parsed.GroupTitle),
			ShowPlayground:  parsed.ShowPlayground,
			ShowChatPresets: true,
			FlatChatPresets: parsed.FlatChatPresets,
			Links:           []SidebarLink{},
		}
		if legacy.Title == "" {
			legacy.Title = "聊天和娱乐"
		}
		if len(parsed.Links) == 0 {
			return normalizeSidebarConfig(SidebarConfig{Groups: []SidebarGroup{legacy}})
		}
		fun := SidebarGroup{
			Title:           "娱乐",
			ShowPlayground:  false,
			ShowChatPresets: false,
			FlatChatPresets: false,
			Links:           parsed.Links,
		}
		return normalizeSidebarConfig(SidebarConfig{Groups: []SidebarGroup{legacy, fun}})
	}
	return def
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
		cleaned = append(cleaned, SidebarLink{Name: name, URL: url, Embed: link.Embed})
		if len(cleaned) >= sidebarMaxLinks {
			break
		}
	}
	return cleaned
}

func normalizeSidebarConfig(cfg SidebarConfig) SidebarConfig {
	groups := make([]SidebarGroup, 0, len(cfg.Groups))
	for _, group := range cfg.Groups {
		title := strings.TrimSpace(group.Title)
		if title == "" {
			continue
		}
		group.Title = title
		group.Links = normalizeSidebarLinks(group.Links)
		groups = append(groups, group)
		if len(groups) >= sidebarMaxGroups {
			break
		}
	}
	if len(groups) == 0 {
		return defaultSidebarConfig()
	}
	return SidebarConfig{Groups: groups}
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
	cfg := normalizeSidebarConfig(req)

	raw, err := common.Marshal(cfg)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(sidebarConfigKey, string(raw)); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, 0, "site.sidebar_config", map[string]interface{}{
		"groups": len(cfg.Groups),
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
