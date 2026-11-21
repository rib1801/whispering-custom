# Whispering — build customizado (v7.11.1)

Cópia do [Whispering v7.11.0](https://github.com/EpicenterHQ/epicenter/releases/tag/v7.11.0)
com quatro ajustes de janela. Base: tag `v7.11.0` do EpicenterHQ/epicenter.

## O que muda

### 1. O X manda para a bandeja

Fechar pelo X não encerra mais o app: esconde a janela e deixa o ícone na bandeja
(perto do relógio). Para encerrar de verdade: **botão direito no ícone → "Fechar o Whispering"**.

Menu do ícone (botão direito):

- Mostrar janela
- Barra compacta
- Configurações
- Fechar o Whispering

Clique esquerdo no ícone mostra/esconde a janela. Na primeira vez que o X é usado,
aparece um aviso explicando que o app continua rodando.

### 2. "Minimize" virou barra compacta, não quadrado

O antigo `setSize(72, 84)` — um quadrado de 72px que cortava os botões
minimizar/restaurar/fechar do Windows — virou uma barra de **360 × 84 px** com:

- microfone (clique grava/para)
- texto de estado
- botão de voltar ao tamanho normal
- botão de esconder na bandeja

Área de arraste: o fundo da barra (`data-tauri-drag-region`), então dá para reposicionar
sem clicar sem querer no microfone.

### 3. A barra compacta lembra onde estava

A posição é gravada em `localStorage` (`whispering-window-compact-position`) a cada
arraste e restaurada no próximo "Minimize". Se a posição salva estiver fora de qualquer
monitor (tela desconectada, resolução trocada), ela é encaixada na área visível.
O tamanho/posição da janela grande também é guardado e restaurado ao expandir de novo
(inclusive o estado maximizado).

### 4. Atualizador automático desligado

O endpoint de auto-update do projeto original foi removido (`tauri.conf.json`) e a
checagem de atualização foi desativada em `check-for-updates.ts`. Sem isso, o app
baixaria a próxima versão oficial e apagaria estes ajustes.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `apps/whispering/src/lib/stores/window-mode.svelte.ts` | **novo** — modo compacto, tamanho, memória de posição, esconder na bandeja |
| `apps/whispering/src/routes/(app)/_components/CompactBar.svelte` | **novo** — a barra horizontal |
| `apps/whispering/src/routes/(app)/+layout.svelte` | renderiza a barra sobre o layout normal |
| `apps/whispering/src/routes/(app)/_components/AppLayout.svelte` | `onCloseRequested` → esconder + aviso único |
| `apps/whispering/src/lib/components/NavItems.svelte` | "Minimize" → `windowMode.enterCompact()` |
| `apps/whispering/src/routes/(app)/_components/VerticalNav.svelte` | idem |
| `apps/whispering/src/lib/services/desktop/tray.ts` | menu pt-BR, clique esquerdo alterna janela |
| `apps/whispering/src/routes/(app)/_layout-utils/check-for-updates.ts` | updater desligado |
| `apps/whispering/src/routes/+layout.svelte` | toasts escondidos no modo compacto |
| `apps/whispering/src-tauri/tauri.conf.json` | `minWidth` 72 → 360, versão 7.11.1, updater removido |
| `apps/whispering/src-tauri/capabilities/default.json` | permissões de janela (posição, monitores, maximizar…) |
| `apps/whispering/src-tauri/src/lib.rs` | segunda instância do app mostra a janela escondida |

### O que NÃO mudou

Transcrição (Parakeet/Whisper/Moonshine/cloud), gravação, transformações, atalhos
globais, banco de gravações, configurações, autostart, tema. O `identifier` continua
`com.bradenwong.whispering`, então o instalador **atualiza** a instalação existente e
mantém dados e ajustes.

## Como compilar (Windows)

```powershell
# dependências: Rust stable (MSVC), Visual Studio Build Tools, Node e Bun
bun install
cd apps/whispering
bunx tauri build --bundles nsis
# instalador em: apps/whispering/src-tauri/target/release/bundle/nsis/*.exe
```
