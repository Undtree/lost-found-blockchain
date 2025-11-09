@echo off
docker stop lost-and-found-mongo
docker rm lost-and-found-mongo
docker run --name lost-and-found-mongo -p 27017:27017 -d mongo

if exist backend\uploads rmdir /s /q backend\uploads
if exist backend\metadata rmdir /s /q backend\metadata

mkdir backend\uploads
mkdir backend\metadata

cd contracts
npm install
cd ..

cd backend
npm install
cd ..

cd frontend
npm install
cd ..
