# ACADEMY — Estrutura Nova

## O que está aqui

| Ficheiro | O que faz | Estado |
|----------|-----------|--------|
| `js/state.js` | Estado da app + todas as constantes (TIPOS, PLANOS, ESTRUTURAS) | ✅ Pronto |
| `js/supabase.js` | Todas as chamadas ao Supabase (pagamentos, docs, admin) | ✅ Pronto |
| `js/auth.js` | Senhas, planos, créditos, exportação | ✅ Pronto |
| `js/navigation.js` | Navegação entre ecrãs (irPara, nav) | 🔜 A fazer |
| `js/generator.js` | Loop de geração com a IA | 🔜 A fazer |
| `js/layout.js` | Motor de paginação PDF | 🔜 A fazer |
| `js/export.js` | Exportar PDF e DOCX | 🔜 A fazer |
| `js/editor.js` | Editor conversacional (EC) | 🔜 A fazer |
| `js/chat.js` | Chat IA + voz | 🔜 A fazer |
| `js/media.js` | Gráficos, tabelas, MEA | 🔜 A fazer |
| `js/pwa.js` | PWA, service worker, install | 🔜 A fazer |
| `css/base.css` | Variáveis, reset, tipografia | 🔜 A fazer |
| `css/layout.css` | Grelha, ecrãs, navegação | 🔜 A fazer |
| `css/components.css` | Botões, cards, modais, chat | 🔜 A fazer |
| `index.html` | Só o esqueleto HTML | 🔜 A fazer (último) |

## Como o `index.html` vai ficar no fim

```html
<!DOCTYPE html>
<html lang="pt">
<head>
  <!-- meta tags, PWA, fonts -->
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/layout.css">
  <link rel="stylesheet" href="css/components.css">
</head>
<body>
  <!-- HTML dos ecrãs aqui (muito mais curto) -->

  <!-- Scripts carregados por ordem de dependência -->
  <script src="js/state.js"></script>      <!-- 1.º: estado e constantes -->
  <script src="js/supabase.js"></script>   <!-- 2.º: Supabase -->
  <script src="js/auth.js"></script>       <!-- 3.º: senhas e planos -->
  <script src="js/navigation.js"></script> <!-- 4.º: navegação -->
  <script src="js/generator.js"></script>  <!-- 5.º: geração IA -->
  <script src="js/layout.js"></script>     <!-- 6.º: paginação -->
  <script src="js/export.js"></script>     <!-- 7.º: PDF/DOCX -->
  <script src="js/editor.js"></script>     <!-- 8.º: editor -->
  <script src="js/chat.js"></script>       <!-- 9.º: chat -->
  <script src="js/media.js"></script>      <!-- 10.º: gráficos -->
  <script src="js/pwa.js"></script>        <!-- 11.º: PWA -->
</body>
</html>
```

## Vantagem directa

Quando o layout do PDF tem um bug → abres só `js/layout.js`  
Quando o chat falha → abres só `js/chat.js`  
Quando um preço muda → abres só `js/state.js` (secção PLANOS_DEF)  

Nunca mais procuras numa agulha de 14.000 linhas.
