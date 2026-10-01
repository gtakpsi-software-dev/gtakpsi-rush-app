"""Prepare pledge headshots before Storage upload."""

import io


def prepare_headshot(file_path, image_module, image_ops):
    # Apply EXIF orientation before resizing so the uploaded image stays upright.
    image = image_module.open(file_path)
    image = image_ops.exif_transpose(image)
    image = image.convert("RGB")
    image.thumbnail((600, 600), image_module.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=82, optimize=True)
    compressed_size = buffer.tell()
    buffer.seek(0)
    return buffer, compressed_size
