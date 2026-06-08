package handlers

import (
	"net/http"

	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type LogoAssetHandler struct {
	service *services.LogoAssetService
}

func NewLogoAssetHandler(service *services.LogoAssetService) *LogoAssetHandler {
	return &LogoAssetHandler{service: service}
}

func (h *LogoAssetHandler) GetLogo(c *gin.Context) {
	path := h.service.ResolveLocalPath("/api/assets/logos/" + c.Param("filename"))
	if path == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "logo not found"})
		return
	}

	c.File(path)
}
