export function setupFileUpload(inputElement, callback) {
  inputElement.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      callback({
        name: file.name,
        content: reader.result,
      });
    };

    reader.readAsText(file);
  });
}
