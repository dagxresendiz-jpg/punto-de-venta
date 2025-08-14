const bcrypt = require('bcrypt');

const password = 'admin123'; // La contraseña que queremos hashear

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error("Error al generar el hash:", err);
    return;
  }
  console.log("¡Copia y pega este hash en tu archivo usuarios.json!");
  console.log("\n");
  console.log(hash);
  console.log("\n");
});