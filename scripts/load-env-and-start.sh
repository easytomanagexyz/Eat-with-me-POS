#!/bin/bash
set -e

echo "Loading environment variables from AWS Parameter Store..."

# Fetch DATABASE_URL_MASTER from Parameter Store
export DATABASE_URL_MASTER=$(aws ssm get-parameter \
  --name "/prod/master-db-url" \
  --with-decryption \
  --region ap-south-1 \
  --query "Parameter.Value" \
  --output text)

if [ -z "$DATABASE_URL_MASTER" ]; then
  echo "Error: Failed to fetch DATABASE_URL_MASTER from Parameter Store"
  exit 1
fi

# ------------------------------
# Fetch tenant DB connection params
# ------------------------------
DB_USER=$(aws ssm get-parameter \
  --name "/eatwithme/db-user" \
  --with-decryption \
  --region ap-south-1 \
  --query "Parameter.Value" \
  --output text)

DB_PASS=$(aws ssm get-parameter \
  --name "/eatwithme/db-password" \
  --with-decryption \
  --region ap-south-1 \
  --query "Parameter.Value" \
  --output text)

DB_HOST=$(aws ssm get-parameter \
  --name "/eatwithme/db-host" \
  --with-decryption \
  --region ap-south-1 \
  --query "Parameter.Value" \
  --output text)

DB_PORT=$(aws ssm get-parameter \
  --name "/eatwithme/db-port" \
  --region ap-south-1 \
  --query "Parameter.Value" \
  --output text)

# ------------------------------
# FIX: Strip double quotes if SSM returns "5432"
# ------------------------------
DB_USER=$(echo "$DB_USER" | tr -d '"')
DB_PASS=$(echo "$DB_PASS" | tr -d '"')
DB_HOST=$(echo "$DB_HOST" | tr -d '"')
DB_PORT=$(echo "$DB_PORT" | tr -d '"')

# Export variables
export DB_USER DB_PASS DB_HOST DB_PORT

echo "Environment variables loaded successfully"
echo "DATABASE_URL_MASTER is set (value hidden for security)"
echo "DB_HOST=$DB_HOST"
echo "DB_PORT=$DB_PORT"

# ------------------------------
# Restart backend
# ------------------------------
echo "Starting/restarting backend with PM2..."
pm2 start dist/server.js --name backend --update-env || pm2 restart backend --update-env
pm2 save

echo "Deployment completed successfully!"
