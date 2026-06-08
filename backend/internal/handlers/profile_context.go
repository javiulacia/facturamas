package handlers

import (
	"strings"

	"github.com/gin-gonic/gin"
)

const profileHeader = "X-Profile-Id"

func getProfileID(c *gin.Context) string {
	if profileID := strings.TrimSpace(c.GetHeader(profileHeader)); profileID != "" {
		return profileID
	}
	return strings.TrimSpace(c.Query("profileId"))
}
