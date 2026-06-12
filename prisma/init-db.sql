-- Executado UMA VEZ pelo Postgres na criação do container (docker-entrypoint-initdb.d).
-- Cria o papel NÃO-superusuário que a aplicação usa quando se quer RLS de verdade.
-- (O superusuário 'postgres' ignora RLS — por isso existe o apurax_app.)

CREATE ROLE apurax_app WITH LOGIN PASSWORD 'apurax_dev' NOSUPERUSER;

GRANT ALL PRIVILEGES ON DATABASE apurax TO apurax_app;

\connect apurax

-- apurax_app precisa poder criar tabelas (prisma migrate) e ser dono delas,
-- para conseguir habilitar/forçar RLS nas próprias tabelas.
GRANT ALL ON SCHEMA public TO apurax_app;
ALTER SCHEMA public OWNER TO apurax_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO apurax_app;
