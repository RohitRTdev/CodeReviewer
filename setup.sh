#! /bin/bash

# Use the build argument to rebuild the docker image forcefully

set -e

RUN_MIGRATIONS=0
COPY_ENV=0
BUILD_OPT=""
RUN=0

for arg in "$@"
do
    if [ "$arg" = "all" ]
    then 
        RUN_MIGRATIONS=1
        COPY_ENV=1
    elif [ "$arg" = "build" ]
    then
        BUILD_OPT="--build"
    elif [ "$arg" = "run" ]
    then
        RUN=1
    fi
done

if [ "$RUN_MIGRATIONS" = "1" ]
then
    echo "Installing dependencies (Primarily to stop intellisense from complaining)"
    npm -C backend install
    npm -C frontend install
    echo "Starting postgres service"
    docker compose up -d postgres
    echo "Waiting for postgres service to accept connections"
    until docker compose exec -T postgres pg_isready -U test_user -d codereview_db >/dev/null 2>&1
    do
        sleep 1
    done
    echo "Running migrations"
    DATABASE_URL="postgres://test_user:12345@localhost:5432/codereview_db?sslmode=disable" npm -C backend run migrate
    echo "Stopping postgres service"
    docker compose stop postgres
fi

JWT_SECRET=$(openssl rand -hex 32)

if [ "$COPY_ENV" = "1" ]
then
    if [ -f ./backend/.env ] 
    then 
        echo "Creating new .env.backup to save the current .env file before overwriting"
        cp ./backend/.env ./backend/.env.backup
    fi
    echo "Creating .env and setting up JWT_SECRET"
    cp ./backend/.env.example ./backend/.env
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" ./backend/.env
    echo ".env is setup. Please fill in the remaining blank keys in ./backend/.env"
fi

if [ "$RUN" = "1" ]
then 
    echo "Starting containers"
    docker compose -f compose.yaml -f compose.dev.yaml up $BUILD_OPT
fi