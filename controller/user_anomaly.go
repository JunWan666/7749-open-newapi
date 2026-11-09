package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// AnomalyUser is a lightweight user row used by the anomaly dashboard.
type AnomalyUser struct {
	Id           int    `json:"id"`
	Username     string `json:"username"`
	Status       int    `json:"status"`
	Role         int    `json:"role"`
	Remark       string `json:"remark"`
	RegisterIp   string `json:"register_ip"`
	LastLoginIp  string `json:"last_login_ip"`
	CreatedAt    int64  `json:"created_at"`
	RequestCount int    `json:"request_count"`
	TotalTokens  int64  `json:"total_tokens"`
	Quota        int    `json:"quota"`
	UsedQuota    int    `json:"used_quota"`
	HandleNote   string `json:"handle_note"`
}

// IgnoredAnomalyUser adds ignore metadata on top of AnomalyUser.
type IgnoredAnomalyUser struct {
	AnomalyUser
	IgnoreReason string `json:"ignore_reason"`
	IgnoredAt    int64  `json:"ignored_at"`
}

// AnomalyIPGroup groups accounts that share the same registration / login IP.
type AnomalyIPGroup struct {
	Ip       string        `json:"ip"`
	Accounts int           `json:"accounts"`
	Users    []AnomalyUser `json:"users"`
}

// IdleCheckinUser is an account that collects check-in quota without ever calling the API.
type IdleCheckinUser struct {
	AnomalyUser
	CheckinDays int64 `json:"checkin_days"`
}

func anomalyExcludeClause(ignoredIds []int) string {
	if len(ignoredIds) == 0 {
		return ""
	}
	parts := make([]string, len(ignoredIds))
	for i, id := range ignoredIds {
		parts[i] = strconv.Itoa(id)
	}
	return " AND u.id NOT IN (" + strings.Join(parts, ",") + ")"
}

// GetUserAnomalies lists accounts that look suspicious:
//  1. several accounts registering / logging in from the same IP
//  2. accounts that only check in and never call any model
//  3. ignored accounts (kept for reference, excluded from the lists above)
func GetUserAnomalies(c *gin.Context) {
	ignoredIds, err := model.GetAnomalyIgnoredUserIds()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	exclude := anomalyExcludeClause(ignoredIds)

	ipGroups := make([]AnomalyIPGroup, 0)
	idleUsers := make([]IdleCheckinUser, 0)
	ignoredUsers := make([]IgnoredAnomalyUser, 0)

	// --- 1. shared IP groups ---
	type ipCountRow struct {
		Ip       string
		Accounts int
	}
	var counts []ipCountRow
	ipQuery := `SELECT ip, count(*) AS accounts FROM (
		SELECT id, CASE WHEN register_ip IS NOT NULL AND register_ip <> '' THEN register_ip ELSE last_login_ip END AS ip
		FROM users WHERE deleted_at IS NULL
	) t WHERE ip IS NOT NULL AND ip <> ''`
	if exclude != "" {
		// exclude needs the users alias; rebuild with a join-free filter on ids
		parts := make([]string, len(ignoredIds))
		for i, id := range ignoredIds {
			parts[i] = strconv.Itoa(id)
		}
		ipQuery = `SELECT ip, count(*) AS accounts FROM (
			SELECT id, CASE WHEN register_ip IS NOT NULL AND register_ip <> '' THEN register_ip ELSE last_login_ip END AS ip
			FROM users WHERE deleted_at IS NULL AND id NOT IN (` + strings.Join(parts, ",") + `)
		) t WHERE ip IS NOT NULL AND ip <> ''`
	}
	ipQuery += ` GROUP BY ip HAVING count(*) >= 2 ORDER BY accounts DESC LIMIT 50`
	if err := model.DB.Raw(ipQuery).Scan(&counts).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	for _, row := range counts {
		var users []AnomalyUser
		userQuery := `SELECT u.id, u.username, u.status, u.role, COALESCE(u.remark,'') AS remark,
			COALESCE(u.register_ip,'') AS register_ip,
			COALESCE(u.last_login_ip,'') AS last_login_ip, u.created_at, u.request_count,
			u.quota, u.used_quota,
			COALESCE(SUM(l.prompt_tokens + l.completion_tokens), 0) AS total_tokens
			FROM users u
			LEFT JOIN logs l ON l.user_id = u.id AND l.type = 2
			WHERE u.deleted_at IS NULL AND (
				u.register_ip = ? OR (u.last_login_ip = ? AND (u.register_ip IS NULL OR u.register_ip = ''))
			)` + exclude + `
			GROUP BY u.id, u.username, u.status, u.role, u.remark, u.register_ip, u.last_login_ip, u.created_at, u.request_count, u.quota, u.used_quota
			ORDER BY u.id`
		if err := model.DB.Raw(userQuery, row.Ip, row.Ip).Scan(&users).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		if len(users) == 0 {
			continue
		}
		ipGroups = append(ipGroups, AnomalyIPGroup{
			Ip:       row.Ip,
			Accounts: len(users),
			Users:    users,
		})
	}

	// --- 2. check-in only accounts (never called the API) ---
	idleQuery := `SELECT u.id, u.username, u.status, u.role, COALESCE(u.remark,'') AS remark,
		COALESCE(u.register_ip,'') AS register_ip,
		COALESCE(u.last_login_ip,'') AS last_login_ip, u.created_at, u.request_count,
		u.quota, u.used_quota,
		count(c.id) AS checkin_days,
		COALESCE((SELECT SUM(l.prompt_tokens + l.completion_tokens) FROM logs l WHERE l.user_id = u.id AND l.type = 2), 0) AS total_tokens
		FROM users u JOIN checkins c ON c.user_id = u.id
		WHERE u.deleted_at IS NULL AND u.request_count = 0` + exclude + `
		GROUP BY u.id, u.username, u.status, u.role, u.remark, u.register_ip, u.last_login_ip, u.created_at, u.request_count, u.quota, u.used_quota
		ORDER BY checkin_days DESC, u.id DESC LIMIT 50`
	if err := model.DB.Raw(idleQuery).Scan(&idleUsers).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	// --- 3. handled accounts (suspicious / disabled, not ignored) ---
	handledUsers := make([]AnomalyUser, 0)
	handledQuery := `SELECT u.id, u.username, u.status, u.role, COALESCE(u.remark,'') AS remark,
		COALESCE(u.register_ip,'') AS register_ip, COALESCE(u.last_login_ip,'') AS last_login_ip,
		u.created_at, u.request_count, u.quota, u.used_quota,
		COALESCE(n.note,'') AS handle_note,
		COALESCE((SELECT SUM(l.prompt_tokens + l.completion_tokens) FROM logs l WHERE l.user_id = u.id AND l.type = 2), 0) AS total_tokens
		FROM users u
		LEFT JOIN anomaly_notes n ON n.user_id = u.id
		WHERE u.deleted_at IS NULL AND u.status IN (?, ?)` + exclude + `
		ORDER BY u.id DESC LIMIT 200`
	if err := model.DB.Raw(handledQuery, common.UserStatusDisabled, common.UserStatusSuspicious).Scan(&handledUsers).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	// --- 4. ignored accounts ---
	ignoredQuery := `SELECT u.id, u.username, u.status, u.role, COALESCE(u.remark,'') AS remark,
		COALESCE(u.register_ip,'') AS register_ip, COALESCE(u.last_login_ip,'') AS last_login_ip,
		u.created_at, u.request_count, u.quota, u.used_quota,
		COALESCE(i.reason,'') AS ignore_reason, i.created_at AS ignored_at,
		COALESCE((SELECT SUM(l.prompt_tokens + l.completion_tokens) FROM logs l WHERE l.user_id = u.id AND l.type = 2), 0) AS total_tokens
		FROM anomaly_ignores i JOIN users u ON u.id = i.user_id
		WHERE u.deleted_at IS NULL
		ORDER BY i.created_at DESC LIMIT 100`
	if err := model.DB.Raw(ignoredQuery).Scan(&ignoredUsers).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"ip_groups":     ipGroups,
			"idle_users":    idleUsers,
			"handled_users": handledUsers,
			"ignored_users": ignoredUsers,
			"total_groups":  len(ipGroups),
			"total_idle":    len(idleUsers),
			"total_handled": len(handledUsers),
			"total_ignored": len(ignoredUsers),
		},
	})
}

// IgnoreAnomalyUser marks an account as reviewed so it stops appearing in the lists.
func IgnoreAnomalyUser(c *gin.Context) {
	var req struct {
		UserId int    `json:"user_id"`
		Reason string `json:"reason"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.UserId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	target, err := model.GetUserById(req.UserId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.AddAnomalyIgnore(req.UserId, strings.TrimSpace(req.Reason)); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, req.UserId, "user.anomaly_ignore", map[string]interface{}{
		"username": target.Username,
		"reason":   req.Reason,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// UnignoreAnomalyUser removes an ignore entry.
func UnignoreAnomalyUser(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := model.RemoveAnomalyIgnore(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, userId, "user.anomaly_unignore", map[string]interface{}{})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// UpdateAnomalyNote saves the admin note for a handled account.
func UpdateAnomalyNote(c *gin.Context) {
	var req struct {
		UserId int    `json:"user_id"`
		Note   string `json:"note"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.UserId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	note := strings.TrimSpace(req.Note)
	if len([]rune(note)) > 500 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	target, err := model.GetUserById(req.UserId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetAnomalyNote(req.UserId, note, common.GetTimestamp()); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, req.UserId, "user.anomaly_note", map[string]interface{}{
		"username": target.Username,
		"note":     note,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"note": note},
	})
}
