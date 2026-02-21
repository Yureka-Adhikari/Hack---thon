export function streamText(text, element, speed = 15) {
  let i = 0;
  element.textContent = "";

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      element.textContent += text[i];
      i++;

      if (i >= text.length) {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}
