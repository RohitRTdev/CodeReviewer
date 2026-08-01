-- migrate:up 

CREATE TABLE users 
(
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    name TEXT,
    token TEXT,
    github_id BIGINT UNIQUE NOT NULL
);

-- migrate:down

DROP TABLE users;