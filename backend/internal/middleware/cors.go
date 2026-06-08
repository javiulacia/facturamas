package middleware

import (
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func allowedOrigins() map[string]struct{} {
	rawOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if strings.TrimSpace(rawOrigins) == "" {
		rawOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
	}

	origins := make(map[string]struct{})
	for _, origin := range strings.Split(rawOrigins, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins[origin] = struct{}{}
		}
	}

	return origins
}

// CORS returns a Gin middleware that handles Cross-Origin Resource Sharing (CORS)
func CORS() gin.HandlerFunc {
	origins := allowedOrigins()

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := origins[origin]; ok {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Profile-Id")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			if origin != "" {
				if _, ok := origins[origin]; !ok {
					c.AbortWithStatus(403)
					return
				}
			}
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
