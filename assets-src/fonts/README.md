# Fuentes — archivos fuente

Estos `.ttf` **no se sirven**. Son la entrada del paso de subset; lo que
despacha la aplicación son los `.woff2` de `projects/shell/public/fonts/`.
Esta carpeta está fuera de `projects/`, así que el build no la ve.

## Montserrat

| Archivo                       | Contenido                                   |
| ----------------------------- | ------------------------------------------- |
| `Montserrat[wght].ttf`        | Variable, eje `wght` 100–900, versión 9.000 |
| `Montserrat-Italic[wght].ttf` | Ídem, itálica                               |

Licencia: SIL Open Font License 1.1, embebida en la tabla `name` de cada
archivo. El subset la conserva (`--name-IDs=*`), así que viaja dentro de cada
`.woff2`.

> **El default del eje `wght` es 100 (Thin), no 400.** Todo `@font-face` de
> esta familia declara `font-weight: 100 900`; sin ese rango la aplicación
> entera renderiza en Thin. Ver `projects/shell/src/styles.css`.

## Regenerar los `.woff2`

Requiere `fonttools` con soporte WOFF2 (probado con 4.60.1):

```bash
pip install "fonttools[woff]==4.60.1"
```

Rangos: los subsets `latin` y `latin-ext`. Tienen que coincidir carácter por
carácter con el `unicode-range` de cada `@font-face` en `styles.css`.

```bash
LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
LATIN_EXT='U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
OUT=projects/shell/public/fonts

for style in normal italic; do
  src='assets-src/fonts/Montserrat[wght].ttf'
  [ "$style" = italic ] && src='assets-src/fonts/Montserrat-Italic[wght].ttf'
  pyftsubset "$src" --unicodes="$LATIN"     --layout-features='*' --name-IDs='*' --flavor=woff2 --output-file="$OUT/montserrat-latin-wght-$style.woff2"
  pyftsubset "$src" --unicodes="$LATIN_EXT" --layout-features='*' --name-IDs='*' --flavor=woff2 --output-file="$OUT/montserrat-latin-ext-wght-$style.woff2"
done
```

`--layout-features='*'` conserva todas las funciones OpenType, incluidas las
cifras tabulares (`tnum`), que las tablas del WMS van a necesitar.

## JetBrains Mono

(pendiente) Entra con su primer consumidor, la Tabla, desde un origen oficial.
Hasta entonces `--font-family-mono` en `tokens.css` es solo la pila del sistema.
