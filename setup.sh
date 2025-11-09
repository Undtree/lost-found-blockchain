#!/bin/bash
docker stop lost-and-found-mongo || true
docker rm lost-and-found-mongo || true
docker run --name lost-and-found-mongo -p 27017:27017 -d mongo

rm -rf backend/uploads
rm -rf backend/metadata
mkdir -p backend/uploads
mkdir -p backend/metadata

(cd contracts && npm install)
(cd backend && npm install)
(cd frontend && npm install)
