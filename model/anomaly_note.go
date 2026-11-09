package model

// AnomalyNote stores the admin's note for an account handled on the anomaly page
// (e.g. why it was marked suspicious). Kept separate from User.Remark.
type AnomalyNote struct {
	UserId    int    `json:"user_id" gorm:"primaryKey;autoIncrement:false;column:user_id"`
	Note      string `json:"note" gorm:"type:varchar(500);default:'';column:note"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;column:updated_at"`
}

func (AnomalyNote) TableName() string {
	return "anomaly_notes"
}

// SetAnomalyNote upserts the note for a user.
func SetAnomalyNote(userId int, note string, now int64) error {
	row := AnomalyNote{UserId: userId, Note: note, UpdatedAt: now}
	return DB.Where(AnomalyNote{UserId: userId}).
		Assign(AnomalyNote{Note: note, UpdatedAt: now}).
		FirstOrCreate(&row).Error
}
