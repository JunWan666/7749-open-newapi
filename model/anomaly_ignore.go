package model

// AnomalyIgnore marks an account as "reviewed and fine" so it no longer shows up
// in the anomaly dashboard, while keeping a record of who ignored it and why.
type AnomalyIgnore struct {
	UserId    int    `json:"user_id" gorm:"primaryKey;autoIncrement:false;column:user_id"`
	Reason    string `json:"reason" gorm:"type:varchar(255);default:'';column:reason"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;column:created_at"`
}

func (AnomalyIgnore) TableName() string {
	return "anomaly_ignores"
}

// GetAnomalyIgnoredUserIds returns all ignored user ids.
func GetAnomalyIgnoredUserIds() ([]int, error) {
	ids := make([]int, 0)
	var rows []AnomalyIgnore
	if err := DB.Find(&rows).Error; err != nil {
		return ids, err
	}
	for _, row := range rows {
		ids = append(ids, row.UserId)
	}
	return ids, nil
}

// AddAnomalyIgnore records an ignore entry (idempotent per user).
func AddAnomalyIgnore(userId int, reason string) error {
	row := AnomalyIgnore{UserId: userId, Reason: reason}
	return DB.Where(AnomalyIgnore{UserId: userId}).
		Assign(AnomalyIgnore{Reason: reason}).
		FirstOrCreate(&row).Error
}

// RemoveAnomalyIgnore deletes an ignore entry.
func RemoveAnomalyIgnore(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&AnomalyIgnore{}).Error
}
