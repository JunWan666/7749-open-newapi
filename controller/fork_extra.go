package controller

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// The WeChat group QR code is stored on disk under the mounted data volume
// (/app/data in docker, ./data in local dev), so replacing it never needs a rebuild.
var groupQrcodeDirs = []string{"/app/data/uploads", "./data/uploads"}
var groupQrcodeExts = []string{".png", ".jpg", ".jpeg", ".webp"}

func findGroupQrcode() (string, bool) {
	for _, dir := range groupQrcodeDirs {
		for _, ext := range groupQrcodeExts {
			p := filepath.Join(dir, "group_qrcode"+ext)
			if info, err := os.Stat(p); err == nil && !info.IsDir() {
				return p, true
			}
		}
	}
	return "", false
}

func writableGroupQrcodeDir() (string, error) {
	var lastErr error
	for _, dir := range groupQrcodeDirs {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			lastErr = err
			continue
		}
		probe := filepath.Join(dir, ".write_probe")
		f, err := os.Create(probe)
		if err != nil {
			lastErr = err
			continue
		}
		_ = f.Close()
		_ = os.Remove(probe)
		return dir, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no writable directory")
	}
	return "", lastErr
}

// GetGroupQrcode serves the current WeChat group QR code image (public, no auth).
func GetGroupQrcode(c *gin.Context) {
	path, ok := findGroupQrcode()
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "no-cache, max-age=0")
	c.File(path)
}

// UploadGroupQrcode lets an admin replace the WeChat group QR code (multipart form field "file").
func UploadGroupQrcode(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "请选择要上传的图片文件")
		return
	}
	if fileHeader.Size > 2*1024*1024 {
		common.ApiErrorMsg(c, "图片大小不能超过 2MB")
		return
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	valid := false
	for _, allowed := range groupQrcodeExts {
		if ext == allowed {
			valid = true
			break
		}
	}
	if !valid {
		common.ApiErrorMsg(c, "仅支持 png / jpg / webp 格式的图片")
		return
	}

	dir, err := writableGroupQrcodeDir()
	if err != nil {
		common.ApiErrorMsg(c, "服务器存储目录不可写："+err.Error())
		return
	}

	// Remove any previous QR code with a different extension.
	if old, ok := findGroupQrcode(); ok && filepath.Dir(old) == dir {
		_ = os.Remove(old)
	}

	target := filepath.Join(dir, "group_qrcode"+ext)
	if err := c.SaveUploadedFile(fileHeader, target); err != nil {
		common.ApiErrorMsg(c, "保存图片失败："+err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"url":     "/api/group-qrcode",
			"updated": true,
		},
	})
}

// DeleteGroupQrcode removes the current QR code so the banner stops showing it.
func DeleteGroupQrcode(c *gin.Context) {
	path, ok := findGroupQrcode()
	if ok {
		if err := os.Remove(path); err != nil {
			common.ApiErrorMsg(c, "删除失败："+err.Error())
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
