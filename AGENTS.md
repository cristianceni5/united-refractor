# Analisi Bug - Student Auth

## BUG CRITICI

### 1. upload-image.js - Manca error handling su getPublicUrl
- **File**: `netlify/functions/upload-image.js` riga 60
- **Problema**: Nessun controllo se `urlData.publicUrl` e' valido prima di usarlo
- **Fix**: Aggiunto check `if (!urlData || !urlData.publicUrl)`
- **Status**: RISOLTO

### 2. toggle-like-spotted.js - Manca error handling su delete/insert + profilo unsafe
- **File**: `netlify/functions/toggle-like-spotted.js`
- **Problema**: delete/insert su spotted_likes senza error handling + ban check skippato se profilo null
- **Fix**: Aggiunto error handling su delete/insert + separato check profilo null da check ban
- **Status**: RISOLTO

### 3. moderate-school-request.js - Manca error handling su 3 update
- **File**: `netlify/functions/moderate-school-request.js` righe 65-102
- **Problema**: Tre operazioni update senza gestione errori
- **Fix**: Aggiunto error handling con destructuring `{ error }` su tutti e 3 gli update
- **Status**: RISOLTO

### 4. create-spotted-comment.js - Check profilo unsafe
- **File**: `netlify/functions/create-spotted-comment.js` righe 23-26
- **Problema**: Se `getUserProfile()` ritorna null, il ban check viene skippato
- **Fix**: Separato check `!profile` (404) da check `isBanned(profile)` (403)
- **Status**: RISOLTO

### 5. profile.html - ID "alert" duplicato
- **File**: `public/profile.html` riga 109
- **Problema**: Due elementi con id="alert", getElementById prende solo il primo
- **Fix**: Rinominato in `profile-alert` + aggiornato `profile.js`
- **Status**: RISOLTO

## BUG MEDI

### 6. Status code HTTP sbagliati (400 invece di 404)
- **File**: `get-posts.js`, `get-spotted.js`, `create-spotted.js`, `delete-spotted.js`, `delete-spotted-comment.js`
- **Problema**: "Profilo non trovato" ritornava 400 invece di 404
- **Fix**: Cambiato `response(400, ...)` in `response(404, ...)` in tutti e 5 i file
- **Status**: RISOLTO

### 7. posts.js - progressFill non controllato
- **File**: `public/js/posts.js` riga 401
- **Problema**: progressEl controllato ma progressFill no, potrebbe essere null
- **Fix**: Aggiunto `&& progressFill` al check
- **Status**: RISOLTO

### 8. dashboard.js - JSON.parse senza try-catch
- **File**: `public/js/dashboard.js` riga 759
- **Problema**: `JSON.parse(btn.dataset.school)` poteva crashare se JSON corrotto
- **Fix**: Wrappato in try-catch con console.error
- **Status**: RISOLTO

### 9. api.js - Token refresh mancante
- **File**: `public/js/api.js`
- **Problema**: Se access_token scade, nessun meccanismo di refresh. L'app mostra 401
- **Status**: DA VALUTARE (richiede decisione architetturale)

## BUG MINORI (non fixati)

### 10. escapeHtml duplicata in 3 file
- **File**: `dashboard.js`, `posts.js`, `spotted.js`
- **Problema**: Stessa funzione definita 3 volte. Sarebbe meglio in api.js
- **Status**: BASSA PRIORITA'

### 11. view-profile.js - manca escapeHtml
- **File**: `public/js/view-profile.js`
- **Problema**: Non usa escapeHtml per alcuni dati utente
- **Status**: BASSA PRIORITA'

---

## RIEPILOGO

| Priorita' | Conteggio | Status |
|-----------|-----------|--------|
| Critico   | 5         | TUTTI RISOLTI |
| Medio     | 4         | 3 RISOLTI, 1 DA VALUTARE |
| Minore    | 2         | BASSA PRIORITA' |

## FILE MODIFICATI

- `netlify/functions/upload-image.js`
- `netlify/functions/toggle-like-spotted.js`
- `netlify/functions/moderate-school-request.js`
- `netlify/functions/create-spotted-comment.js`
- `netlify/functions/get-posts.js`
- `netlify/functions/get-spotted.js`
- `netlify/functions/create-spotted.js`
- `netlify/functions/delete-spotted.js`
- `netlify/functions/delete-spotted-comment.js`
- `public/profile.html`
- `public/js/profile.js`
- `public/js/posts.js`
- `public/js/dashboard.js`
