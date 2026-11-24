const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Add the misses from earlier
  content = content.replace(/\bcategoria:\s*m\.grupo_terapeutico/g, 'grupo_terapeutico: m.grupo_terapeutico');
  content = content.replace(/\bcategoria:\s*med\?\.grupo_terapeutico/g, 'grupo_terapeutico: med?.grupo_terapeutico');
  content = content.replace(/\bCategoria:\s*"Categorias"/g, 'GrupoTerapeutico: "GrupoTerapeutico"');
  content = content.replace(/\bgetCategoriaColor\b/g, 'getGrupoColor');
  content = content.replace(/\bisPsicotropico\(categoria\)/g, 'isPsicotropico(grupo_terapeutico)');
  content = content.replace(/\bcategoria\.toUpperCase\(\)/g, 'grupo_terapeutico.toUpperCase()');
  content = content.replace(/\b\!categoria\b/g, '!grupo_terapeutico');
  content = content.replace(/\@param\s+\{string\}\s+categoria\b/g, '@param {string} grupo_terapeutico');
  content = content.replace(/\bcategoriaData\b/g, 'grupoData');
  content = content.replace(/\bCategoriaChart\b/g, 'GrupoChart');
  content = content.replace(/\bCATEGORIA_LABELS\b/g, 'GRUPO_LABELS');
  content = content.replace(/\bcategoria="Categoria"/g, 'categoria="Grupo Terapêutico"');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Total files changed: ${changedFiles}`);
