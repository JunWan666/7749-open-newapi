package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// AnomalyUser is a lightweight user row used by the anomaly dashboard.
type AnomalyUser struct {
	Id           int    `json:"id"`
	Username     string `json:"username"`
	Status       int    `json:"status"`
	RegisterIp   string `json:"register_ip"`
	LastLoginIp  string `json:"last_login_ip"`
	CreatedAt    int64  `json:"created_at"`
	RequestCount int    `json:"request_count"`
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

// GetUserAnomalies lists accounts that look suspicious:
//  1. several accounts registering / logging in from the same IP
//  2. accounts that only check in and never call any model
func GetUserAnomalies(c *gin.Context) {
	ipGroups := make([]AnomalyIPGroup, 0)
	idleUsers := make([]IdleCheckinUser, 0)

	// --- 1. shared IP groups ---
	type ipCountRow struct {
		Ip       string
		Accounts int
	}
	var counts []ipCountRow
	ipQuery := `SELECT ip, count(*) AS accounts FROM (
		SELECT CASE WHEN register_ip IS NOT NULL AND register_ip <> '' THEN register_ip ELSE last_login_ip END AS ip
		FROM users WHERE deleted_at IS NULL
	) t WHERE ip IS NOT NULL AND ip <> '' GROUP BY ip HAVING count(*) >= 2 ORDER BY accounts DESC LIMIT 50`
	if err := model.DB.Raw(ipQuery).Scan(&counts).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	for _, row := range counts {
		var users []AnomalyUser
		userQuery := `SELECT id, username, status, COALESCE(register_ip,'') AS register_ip,
			COALESCE(last_login_ip,'') AS last_login_ip, created_at, request_count
			FROM users
			WHERE deleted_at IS NULL AND (
				register_ip = ? OR (last_login_ip = ? AND (register_ip IS NULL OR register_ip = ''))
			)
			ORDER BY id`
		if err := model.DB.Raw(userQuery, row.Ip, row.Ip).Scan(&users).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		ipGroups = append(ipGroups, AnomalyIPGroup{
			Ip:       row.Ip,
			Accounts: len(users),
			Users:    users,
		})
	}

	// --- 2. check-in only accounts (never called the API) ---
	idleQuery := `SELECT u.id, u.username, u.status, COALESCE(u.register_ip,'') AS register_ip,
		COALESCE(u.last_login_ip,'') AS last_login_ip, u.created_at, u.request_count,
		count(c.id) AS checkin_days
		FROM users u JOIN checkins c ON c.user_id = u.id
		WHERE u.deleted_at IS NULL AND u.request_count = 0
		GROUP BY u.id, u.username, u.status, u.register_ip, u.last_login_ip, u.created_at, u.request_count
		ORDER BY checkin_days DESC, u.id DESC LIMIT 50`
	if err := model.DB.Raw(idleQuery).Scan(&idleUsers).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"ip_groups":    ipGroups,
			"idle_users":   idleUsers,
			"total_groups": len(ipGroups),
			"total_idle":   len(idleUsers),
		},
	})
}
