# Deploy gratuito: GitHub Pages (painel) + Render (API) + TiDB Cloud (MySQL)

| Peça | Onde | Custo |
|---|---|---|
| Painel 3D (front estático) | GitHub Pages | grátis |
| API Node/Express + IA | Render (Web Service, plano Free) | grátis — "dorme" após 15 min sem acesso (acorda em ~1 min) |
| Banco MySQL | TiDB Cloud Starter (compatível com MySQL) | grátis dentro da cota mensal |

Segredos (senha do banco, chaves de IA) ficam **só** nas variáveis de ambiente do Render — nunca no repositório.

## 1. Exportar o banco local
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p --databases erp_industrial_analytics --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 --result-file=dump.sql
# remove DEFINER (o usuário root@localhost não existe na nuvem)
(Get-Content dump.sql -Encoding UTF8) -replace 'DEFINER=`[^`]*`@`[^`]*`','' | Set-Content dump_nuvem.sql -Encoding UTF8
```
## 2. Importar no TiDB Cloud
No TiDB Cloud: cluster → **Connect** → gere a senha e copie host, porta (4000), usuário (`xxxx.root`).
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h HOST -P 4000 -u USUARIO -p --ssl-mode=VERIFY_IDENTITY --default-character-set=utf8mb4 -e "source dump_nuvem.sql"
```
## 3. API no Render (New → Web Service → repositório do GitHub)
Root Directory `api` · Build `npm install` · Start `npm start` · Instance Type **Free**.
Variáveis: `DB_HOST`, `DB_PORT=4000`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=erp_industrial_analytics`, `DB_SSL=true`,
`AI_PROVIDER=groq`, `GROQ_API_KEY`, `CORS_ORIGIN=https://SEU-USUARIO.github.io`.
Teste: `https://SUA-API.onrender.com/api/health` e `/api/ai/selftest`.
## 4. Ligar o painel
GitHub → Settings → Secrets and variables → Actions → **Variables** → `API_URL` = URL do Render (sem barra no final). Rode de novo o workflow *Deploy Pages*.
## 5. Manter acordada (opcional)
Monitor gratuito (UptimeRobot) em `https://SUA-API.onrender.com/api/ping` a cada 5 min. Uma API ligada o mês todo cabe nas 750 h do plano Free.
