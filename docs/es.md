# Luxtronik

## Presentación

Esta integración lleva a Gladys las bombas de calor con un regulador **Luxtronik 2.0 o 2.1**, en su red local, sin ninguna nube: Alpha Innotec, Novelan, Siemens, Buderus, Nibe AP, Roth, Elco, Wolf y las demás marcas que lo usan.

Gladys lee las temperaturas, el modo de funcionamiento y el estado, el compresor y la resistencia de apoyo, el registro de errores, los contadores de potencia y de energía cuando el regulador los proporciona, y puede (solo si usted lo permite) cambiar los modos de calefacción y agua caliente, la «temperatura +/-», la consigna de agua caliente y la refrigeración.

Sin relación con Alpha Innotec ni con las marcas citadas.

![Los widgets «Bomba de calor», «Curvas de la bomba», «Energía de la bomba» y «Registro de la bomba» (ilustración generada, no es una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-luxtronik/main/docs/assets/widgets.es.png)

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- El regulador de la bomba de calor conectado a su red **por cable** (Ethernet), en la misma red que Gladys.
- Una dirección IP fija para el regulador (una reserva DHCP en su router). Aparece en el regulador, en **Servicio > Información > Dirección IP**.
- Nada que instalar en el regulador: Gladys usa su puerto integrado 8889, el de las herramientas de Alpha Innotec y de las integraciones de Home Assistant.

## Configuración

### Bomba de calor

Escriba la dirección IP del regulador en **Dirección de la bomba de calor** (varias bombas de calor: separe las direcciones con comas; añada `:puerto` solo si su instalador cambió el puerto 8889) y pulse **Buscar y probar las bombas de calor**.

**Buscar también en la red**: Gladys envía además el mensaje de búsqueda de Alpha Innotec a los puertos UDP 4444 y 47808. No todos los firmwares responden: la dirección escrita es la vía fiable.

**Intervalo de lectura**: cada cuánto se lee el regulador, de 30 segundos a 5 minutos. El regulador tolera mal las peticiones frecuentes: la integración abre una sola conexión a la vez y la cierra después de cada lectura.

### Cambiar ajustes

**Permitir cambios** está desactivado por defecto: Gladys solo lee. Una vez marcado, los modos de calefacción y agua caliente, la temperatura +/-, la consigna de agua caliente y la refrigeración se pueden cambiar desde Gladys. Cada cambio se escribe en la memoria del regulador, que se desgasta, así que la integración:

- nunca escribe un valor que ya está puesto;
- cambia un mismo ajuste como máximo cada 2 minutos, y 50 ajustes al día como máximo;
- solo acepta valores dentro de límites seguros (agua caliente de 30 a 65 °C, temperatura +/- de −5 a +5 °C, refrigeración de 18 a 30 °C) y rechaza los demás;
- vuelve a leer el valor después de escribirlo;
- nunca escribe en los firmwares V1.90.x y V2.90.x, que se bloquean con cualquier cambio (actualice antes el firmware).

**Idioma de los nombres y textos**: el idioma de los nombres de las funciones, de los modos y de los mensajes de error.

## Uso

### Dispositivos

Abra la pestaña **Descubrir** de la integración y añada los dispositivos de la bomba de calor:

- **Bomba de calor**: temperaturas exterior (y exterior media), de impulsión, de retorno, consigna de retorno, gas caliente, entrada y salida de la fuente de calor, temperatura ambiente con una unidad de ambiente, modo de funcionamiento, estado, último error, compresor y resistencia de apoyo (encendido / apagado), potencia eléctrica y electricidad consumida, potencia térmica y calor producido (cuando el regulador los proporciona), horas y arranques del compresor, horas de la resistencia.
- **Bomba de calor – calefacción**: modo de calefacción (automático, 2.º generador, fiesta, vacaciones, apagado) y temperatura +/- (el desplazamiento de la curva de calefacción, como en el regulador).
- **Bomba de calor – agua caliente** (si la bomba de calor produce agua caliente): temperatura, consigna, modo, calentando ahora.
- **Bomba de calor – refrigeración** (si puede refrigerar): refrigeración encendida / apagada (automática) y su consigna.

Añada **Electricidad consumida** al seguimiento de energía de Gladys para ver el consumo y el coste de la bomba de calor. **Calor producido** es el calor entregado (no electricidad): sirve para el historial.

### Widgets

- **Bomba de calor**: lo que hace ahora: modo, estado, compresor, resistencia de apoyo, temperaturas exterior, de impulsión, de retorno y de agua caliente, potencia absorbida.
- **Curvas de la bomba**: temperaturas exterior, de impulsión, de retorno y de agua caliente durante 24 horas, 3 o 7 días (los dispositivos deben estar añadidos).
- **Energía de la bomba**: calor producido, electricidad consumida, rendimiento (calor ÷ electricidad desde la puesta en marcha), horas y arranques del compresor, horas de la resistencia.
- **Registro de la bomba**: los últimos errores y paradas del compresor del regulador, con sus fechas.

### Escenas

Disparadores: **La bomba de calor indica un error** (una nueva entrada en su registro, con el código y su significado), **La bomba de calor cambia de modo** (filtro por el modo nuevo o el anterior: calefacción, agua caliente, desescarche, bloqueo de la compañía, refrigeración, sin demanda…), **La resistencia de apoyo se enciende**, **La resistencia de apoyo se apaga** (con su duración), **La bomba de calor deja de responder** (3 minutos), **La bomba de calor vuelve a responder**.

Acción: **Leer la bomba de calor** (modo, estado, temperaturas, consigna de agua caliente, potencia, último error), para un mensaje o una condición.

Ejemplos:

- La bomba de calor indica un error → enviar una notificación con `{{triggerEvent.data.error_text}}`.
- La resistencia de apoyo se enciende → enviar un mensaje: la electricidad es cara, revise la bomba de calor.
- La bomba de calor pasa a desescarche → no encender ahora el extractor del baño.

## Solución de problemas

- **«Ninguna bomba de calor responde en el puerto 8889»**: compruebe la dirección IP en el regulador, el cable de red y que nada más (una herramienta antigua, otro sistema domótico) mantenga una conexión abierta: el regulador acepta pocos clientes.
- **La búsqueda en la red no encuentra nada**: normal con algunos firmwares; escriba la dirección.
- **«Los cambios están desactivados»**: marque **Permitir cambios** en los ajustes.
- **«El firmware … bloquea el regulador»**: los firmwares V1.90 y V2.90 no aceptan cambios por la red; la lectura funciona.
- **Falta un valor** (temperatura ambiente, potencia, energía): su regulador no lo proporciona; una actualización del firmware a veces lo añade.
- El botón **Buscar y probar las bombas de calor** muestra lo que ve la integración; la pestaña Logs de la integración da más detalles.

Informe de un problema en [GitHub](https://github.com/William-De71/gladys-luxtronik/issues) con su versión de Gladys, la versión de la integración, el modelo de bomba de calor, el firmware del regulador y los logs.
