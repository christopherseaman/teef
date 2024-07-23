# Basic annotation web app

This is an annotation app for x-ray images. The masks identify teeth as green and it may be edited using a brush and eraser.

## Functionality
- Upon load the img param with dictate the filename of the image + mask to be loaded, if none then load the first image
- Drawing should create full white on the image, which is then applied to the canvas as green channel only. okay to have the client treat the mask image as having an alpha channel
- Clicking next/previous should save the existing (edited) mask as a grayscale image, discarding the alpha. okay to have the client treat the mask image as having an alpha channel but the saved image should be grayscale
- The document canvas should have three layers green overlay, greyscale mask dictating opacity of overlay (black = 100% transparent, white = 255 * MAX_OPACITY), greyscale xray image
- There is a clear button that sets the mask to black (overlay 100% transparent)

## Example usage
1. Load page with image/mask pair
2. Existing grayscale mask drawn with white → green, black → transparent, max 40% opacity
3. Drawing on the image creates white paths, shown as green as max opacity
4. Erasing on the image creates black paths, shown as full transparency
5. Clicking clear sets the whole image to black, shown as full transparency
6. Clicking next/previous saves the current mask as a greyscale image, discarding transparency
7. Image saves as a jpg with 98% quality
8. Canvases are reset
9. Next/previous image/mask pair shown (start over)

## Notes
- The mask no longer darkens the image. Instead, it applies a green overlay with varying opacity.
- Drawing on the mask is now in grayscale, with the green overlay being generated from this grayscale mask.
- Saving masks should maintain white -> white, black -> black for unedited portions of the mask