-- migrate:up

CREATE TABLE repo 
(
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT,
    webhook_id BIGINT UNIQUE NOT NULL,
    secret TEXT,
    github_repo_id BIGINT UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id)
);

-- migrate:down
DROP TABLE repo;