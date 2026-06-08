package services

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const logoAssetURLPrefix = "/api/assets/logos/"

type LogoAssetService struct {
	logoDir string
}

func NewLogoAssetService(logoDir string) *LogoAssetService {
	_ = os.MkdirAll(logoDir, 0755)
	return &LogoAssetService{logoDir: logoDir}
}

func (s *LogoAssetService) NormalizeLogoURL(ctx context.Context, profileID string, rawURL string) (string, error) {
	logoURL := strings.TrimSpace(rawURL)
	if logoURL == "" {
		return "", nil
	}

	if s.IsLocalAssetURL(logoURL) {
		return logoURL, nil
	}

	data, ext, err := s.downloadLogo(ctx, logoURL)
	if err != nil {
		return "", err
	}

	sum := sha1.Sum(data)
	filename := fmt.Sprintf("%s-%s.%s", profileID, hex.EncodeToString(sum[:8]), ext)
	targetPath := filepath.Join(s.logoDir, filename)
	if err := os.WriteFile(targetPath, data, 0644); err != nil {
		return "", err
	}

	return logoAssetURLPrefix + filename, nil
}

func (s *LogoAssetService) IsLocalAssetURL(rawURL string) bool {
	return strings.HasPrefix(strings.TrimSpace(rawURL), logoAssetURLPrefix)
}

func (s *LogoAssetService) ResolveLocalPath(rawURL string) string {
	if !s.IsLocalAssetURL(rawURL) {
		return ""
	}
	filename := strings.TrimPrefix(strings.TrimSpace(rawURL), logoAssetURLPrefix)
	filename = filepath.Base(filename)
	return filepath.Join(s.logoDir, filename)
}

func (s *LogoAssetService) downloadLogo(ctx context.Context, rawURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("logo download failed with status %d", resp.StatusCode)
	}

	ext := imageTypeFromContentType(resp.Header.Get("Content-Type"))
	if ext == "" {
		ext = imageTypeFromURL(rawURL)
	}
	if ext == "" {
		return nil, "", fmt.Errorf("unsupported logo image type")
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return nil, "", err
	}
	if len(data) == 0 {
		return nil, "", fmt.Errorf("empty logo image")
	}

	return data, ext, nil
}
