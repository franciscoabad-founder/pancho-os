cat << 'EOF' > /etc/caddy/Caddyfile
os.franciscoabad.com, pancho-os.franciscoabad.com {
    reverse_proxy localhost:4322
}
EOF
systemctl restart caddy
