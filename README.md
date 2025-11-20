# POS simple (HTML + JS)

Aplicación de punto de venta minimalista en HTML + JS puro. No requiere backend y persiste datos en `~/.pos_app` cuando se ejecuta en entornos con Node/Electron (modo escritorio); en navegadores utiliza `localStorage` como respaldo.

## Características principales
- **Carga de productos por CSV** con paso de mapeo (referencia, descripción, código de barras y precio de venta).
- **Buscador en tiempo real** por referencia, descripción o código de barras (compatible con escáner).
- **Ticket editable**: añade productos con precio/DTO opcional, modifica cantidades o elimina líneas.
- **IVA configurable por ticket** y plantilla editable (encabezado, pie, IVA por defecto e impresora predeterminada).
- **Gestión de caja**: abrir/cerrar, imprimir tickets en impresora térmica del sistema (seleccionable en configuración) y exportar ventas diarias a CSV (referencia y número de ventas) al cerrar caja.
- **Historial del día** y tickets persistidos para auditoría.
- **Almacenamiento local** seguro en `~/.pos_app/state.json` (o `localStorage` si el FS no está disponible).

## Uso
1. Abre `index.html` en tu navegador o empaqueta los archivos en una app de escritorio (Electron/tauri) para acceso directo al FS.
2. Importa un CSV desde **Productos → Importar CSV** y mapea columnas antes de guardar.
3. Busca o escanea productos y añádelos al ticket; ajusta precio/DTO por línea y el IVA del ticket.
4. Pulsa **Cobrar e imprimir ticket** para registrar la venta, guardar el ticket y lanzar la impresión (usa la impresora indicada en configuración).
5. Usa **Abrir caja** antes de cobrar; al **Cerrar caja** podrás exportar un CSV con las ventas del día y se imprime un ticket con el total de caja.
6. Todas las preferencias (encabezado/pie, impresora, IVA por defecto) y los tickets se guardan en `~/.pos_app` o en `localStorage` si no hay acceso al sistema de archivos.

## Notas sobre almacenamiento
- Si se ejecuta en un entorno con `require` disponible, los datos se guardan en `~/.pos_app/state.json` para evitar problemas de permisos.
- En modo navegador la app usa `localStorage` con la misma estructura de datos.
- Incluye encabezado, pie, impresora, IVA por defecto, productos, tickets, ventas del día y estado de caja.

## Exportaciones
- **Productos**: `productos.csv` con referencia, descripción, código de barras y precio.
- **Ventas del día**: `ventas_dia.csv` con referencia y número de unidades vendidas, solicitado al cerrar caja o desde el panel de ventas.

## Estructura del ticket
- Encabezado y pie editables.
- Desglose de base imponible, IVA aplicado y total.
- Muestra impresora seleccionada para una configuración rápida en sistemas con múltiples dispositivos.

## Requisitos
- Navegador moderno (para impresión y descarga de CSV).
- Opcional: entorno Node/Electron para persistir en `~/.pos_app` y configurar impresora del sistema.
