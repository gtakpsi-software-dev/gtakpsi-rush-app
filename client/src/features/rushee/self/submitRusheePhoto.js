// Return toast options for photo-update notifications.
function toastOptions() {
    return {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
    };
}

// Upload a new profile photo, save its URL, and reload after a successful update.
export async function submitRusheePhoto({
    image, gtid, api, storage, setLoading, makeStorageRef, toBlob,
    upload, getDownloadUrl, post, toast, reload, navigate, logger, now = Date.now,
}) {
    setLoading(true);

    try {
        // Keep profile images under the existing GTID and timestamp path in Storage.
        const fileName = `profile-pictures/${gtid}_${now()}.jpg`;
        const storageRef = makeStorageRef(storage, fileName);

        const blob = toBlob(image);
        await upload(storageRef, blob);

        // The returned download URL grants access to the image; persist it only as image_url.
        const imageUrl = await getDownloadUrl(storageRef);
        const payload = [{ field: "image_url", new_value: imageUrl }];

        await post(`${api}/rushee/update-rushee/${gtid}`, payload)
            .then((response) => {
                // Reload after a successful photo update or show the returned error.
                if (response.data.status == "success") {
                    reload();
                } else {
                    toast.error(`${response.data.message}`, toastOptions());
                }
            })
            .catch(() => {
                // Show a network error for a rejected photo-update request.
                toast.error("Some internal network error occurred", toastOptions());
            });
    } catch (error) {
        logger.error("Error uploading image:", error);
        navigate("/error/Uh Oh! Something Unexpected Occurred../There was an error uploading your image to the cloud.");
        return;
    }

    setLoading(false);
}
