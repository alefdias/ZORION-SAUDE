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

  // Substituições de objeto.categoria para objeto.grupo_terapeutico
  content = content.replace(/\bmed\.categoria\b/g, 'med.grupo_terapeutico');
  content = content.replace(/\bm\.categoria\b/g, 'm.grupo_terapeutico');
  content = content.replace(/\bitem\.categoria\b/g, 'item.grupo_terapeutico');
  content = content.replace(/\blote\.categoria\b/g, 'lote.grupo_terapeutico');
  content = content.replace(/\bl\.categoria\b/g, 'l.grupo_terapeutico');
  content = content.replace(/\bform\.categoria\b/g, 'form.grupo_terapeutico');
  content = content.replace(/\bvisibleColumns\.categoria\b/g, 'visibleColumns.grupo_terapeutico');
  content = content.replace(/\bfilterCategoria\b/g, 'filterGrupo');
  content = content.replace(/\bsetFilterCategoria\b/g, 'setFilterGrupo');
  content = content.replace(/\bcategoriaData\b/g, 'grupoData');
  content = content.replace(/\bcategoriasContadas\b/g, 'gruposContados');
  content = content.replace(/\bgetCategoriaColor\b/g, 'getGrupoColor');
  content = content.replace(/\bcategoria:\s*m?e?d?\.?categoria\b/g, 'grupo_terapeutico: m.grupo_terapeutico');
  
  // db.js schema
  content = content.replace(/categoria:\s*'text',/g, 'grupo_terapeutico: \'text\',');
  content = content.replace(/categoria:\s*""/g, 'grupo_terapeutico: ""');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Total files changed: ${changedFiles}`);
