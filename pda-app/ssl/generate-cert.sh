#!/bin/bash
echo "生成自签名SSL证书..."
echo

# 生成私钥和证书
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost/O=PDA-App/C=CN" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.5.105"

if [ $? -eq 0 ]; then
    echo
    echo "证书生成成功！"
    echo "  - cert.pem: SSL证书"
    echo "  - key.pem: 私钥"
    echo
    echo "请重启PDA应用以使用HTTPS"
else
    echo "证书生成失败"
fi
