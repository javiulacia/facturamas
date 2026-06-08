FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git (required by go mod download)
RUN apk add --no-cache git

# Copy go mod files (go.sum optional)
COPY go.mod* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/main.go

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates
RUN mkdir -p /root/storage/pdfs

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/server .
COPY --from=builder /app/.env.example .

EXPOSE 3000

CMD ["./server"]
