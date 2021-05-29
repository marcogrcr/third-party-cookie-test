#!/bin/bash
openssl ecparam -genkey -name prime256v1 -out key.pem
openssl req -x509 -newkey ec:key.pem -nodes -keyout key.pem -out cert.pem -days 365 -subj '/CN=cookies.example' -extensions SAN -config <(cat /etc/ssl/openssl.cnf <(printf "[SAN]\nsubjectAltName='DNS.1:auth.cookies.example,DNS.2:foo.cookies.example,DNS.3:sub.foo.cookies.example,DNS.2:bar.example'"))
