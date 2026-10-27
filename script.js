    (() => {
      "use strict";

      const STORAGE_KEY = "gather-graze-recipes-v1";
      const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
      const form = document.querySelector("#recipe-form");
      const grid = document.querySelector("#recipe-grid");
      const searchInput = document.querySelector("#search");
      const titleInput = document.querySelector("#title");
      const ingredientsInput = document.querySelector("#ingredients");
      const instructionsInput = document.querySelector("#instructions");
      const imageInput = document.querySelector("#image");
      const imagePreview = document.querySelector("#image-preview");
      const uploadName = document.querySelector("#upload-name");
      const formTitle = document.querySelector("#form-title");
      const submitButton = document.querySelector("#submit-button");
      const cancelButton = document.querySelector("#cancel-button");
      const formStatus = document.querySelector("#form-status");
      const dialog = document.querySelector("#recipe-dialog");
      let recipes = loadRecipes();
      let editingId = null;
      let currentDialogId = null;
      let draftImage = null;
      let previewUrl = null;

      function loadRecipes() {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) return [];
          const parsed = JSON.parse(saved);
          if (!Array.isArray(parsed) || !parsed.every(isRecipe)) {
            showStatus("Saved recipes could not be read because the stored data is invalid.", false);
            return [];
          }
          return parsed;
        } catch (error) {
          showStatus("Saved recipes could not be loaded from this browser. Check your storage settings and reload.", false);
          return [];
        }
      }

      function isRecipe(value) {
        return value && typeof value.id === "string" &&
          typeof value.title === "string" && Array.isArray(value.ingredients) &&
          value.ingredients.every(item => typeof item === "string") &&
          typeof value.instructions === "string" &&
          (value.image === null || typeof value.image === "string");
      }

      function saveRecipes(nextRecipes) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecipes));
          recipes = nextRecipes;
          return true;
        } catch (error) {
          showStatus("Your change could not be saved. Browser storage may be full or unavailable; remove a large image or free storage and try again.", false);
          return false;
        }
      }

      function showStatus(message, success) {
        formStatus.textContent = message;
        formStatus.classList.toggle("success", success);
      }

      function updateCount() {
        document.querySelector("#recipe-count").textContent = String(recipes.length);
      }

      function createButton(label, className, action, recipeId) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `button button-small ${className || ""}`.trim();
        button.textContent = label;
        button.addEventListener("click", () => action(recipeId));
        return button;
      }

      function render() {
        grid.replaceChildren();
        updateCount();
        const query = searchInput.value.trim().toLocaleLowerCase();
        const visibleRecipes = recipes.filter(recipe =>
          recipe.title.toLocaleLowerCase().includes(query) ||
          recipe.ingredients.join(" ").toLocaleLowerCase().includes(query)
        );

        if (visibleRecipes.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          const mark = document.createElement("div");
          mark.className = "empty-mark";
          mark.setAttribute("aria-hidden", "true");
          mark.textContent = query ? "⌕" : "♨";
          const heading = document.createElement("h3");
          heading.textContent = query ? "No recipes found" : "Your collection starts here";
          const description = document.createElement("p");
          description.textContent = query
            ? "Try another title or ingredient, or clear your search."
            : "Add a favorite recipe using the form. It will be waiting here the next time you visit.";
          empty.append(mark, heading, description);
          grid.append(empty);
          return;
        }

        visibleRecipes.forEach(recipe => {
          const card = document.createElement("article");
          card.className = "recipe-card";
          if (recipe.image) {
            const image = document.createElement("img");
            image.className = "card-image";
            image.src = recipe.image;
            image.alt = `Photo of ${recipe.title}`;
            card.append(image);
          } else {
            const placeholder = document.createElement("div");
            placeholder.className = "card-placeholder";
            placeholder.setAttribute("aria-hidden", "true");
            placeholder.textContent = "✳";
            card.append(placeholder);
          }

          const content = document.createElement("div");
          content.className = "card-content";
          const kicker = document.createElement("p");
          kicker.className = "card-kicker";
          kicker.textContent = `${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "ingredient" : "ingredients"}`;
          const title = document.createElement("h3");
          title.textContent = recipe.title;
          const summary = document.createElement("p");
          summary.className = "card-summary";
          summary.textContent = recipe.ingredients.slice(0, 3).join(" · ") || "A recipe to remember.";
          const actions = document.createElement("div");
          actions.className = "card-actions";
          actions.append(
            createButton("View", "", viewRecipe, recipe.id),
            createButton("Edit", "", startEditing, recipe.id),
            createButton("Delete", "button-delete", deleteRecipe, recipe.id)
          );
          content.append(kicker, title, summary, actions);
          card.append(content);
          grid.append(card);
        });
      }

      function resetForm() {
        form.reset();
        editingId = null;
        draftImage = null;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        formTitle.textContent = "Add a recipe";
        formTitle.nextElementSibling.textContent = "Start collecting something delicious.";
        submitButton.querySelector("span").textContent = "Add recipe";
        cancelButton.hidden = true;
        imagePreview.removeAttribute("src");
        imagePreview.classList.remove("visible");
        uploadName.textContent = "Choose a food photo";
        showStatus("", true);
      }

      function startEditing(id) {
        const recipe = recipes.find(item => item.id === id);
        if (!recipe) return;
        editingId = id;
        draftImage = recipe.image;
        titleInput.value = recipe.title;
        ingredientsInput.value = recipe.ingredients.join("\n");
        instructionsInput.value = recipe.instructions;
        formTitle.textContent = "Edit your recipe";
        formTitle.nextElementSibling.textContent = "Make a little update to your recipe.";
        submitButton.querySelector("span").textContent = "Save changes";
        cancelButton.hidden = false;
        uploadName.textContent = recipe.image ? "Current photo kept unless replaced" : "Choose a food photo";
        if (recipe.image) {
          imagePreview.src = recipe.image;
          imagePreview.classList.add("visible");
        } else {
          imagePreview.removeAttribute("src");
          imagePreview.classList.remove("visible");
        }
        showStatus("", true);
        titleInput.focus();
        document.querySelector(".form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function viewRecipe(id) {
        const recipe = recipes.find(item => item.id === id);
        if (!recipe) return;
        currentDialogId = id;
        document.querySelector("#dialog-title").textContent = recipe.title;
        const dialogImage = document.querySelector("#dialog-image");
        if (recipe.image) {
          dialogImage.src = recipe.image;
          dialogImage.alt = `Photo of ${recipe.title}`;
          dialogImage.hidden = false;
        } else {
          dialogImage.hidden = true;
          dialogImage.removeAttribute("src");
        }
        const ingredientList = document.querySelector("#dialog-ingredients");
        ingredientList.replaceChildren();
        recipe.ingredients.forEach(item => {
          const listItem = document.createElement("li");
          listItem.textContent = item;
          ingredientList.append(listItem);
        });
        document.querySelector("#dialog-instructions").textContent = recipe.instructions;
        dialog.showModal();
      }

      function deleteRecipe(id) {
        const recipe = recipes.find(item => item.id === id);
        if (!recipe || !window.confirm(`Delete "${recipe.title}" from your collection?`)) return;
        const nextRecipes = recipes.filter(item => item.id !== id);
        if (!saveRecipes(nextRecipes)) return;
        if (editingId === id) resetForm();
        if (currentDialogId === id && dialog.open) dialog.close();
        showStatus("Recipe deleted.", true);
        render();
      }

      function readImage(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("The selected image could not be read."));
          });
          reader.addEventListener("error", () => reject(new Error("The selected image could not be read. Please choose another file.")));
          reader.readAsDataURL(file);
        });
      }

      imageInput.addEventListener("change", () => {
        const file = imageInput.files && imageInput.files[0];
        if (!file) return;
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
          imageInput.value = "";
          showStatus("Choose a JPG, PNG, GIF, or WebP image.", false);
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          imageInput.value = "";
          showStatus("That image is larger than 2 MB. Choose a smaller image.", false);
          return;
        }
        draftImage = null;
        uploadName.textContent = file.name;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        imagePreview.src = previewUrl;
        imagePreview.classList.add("visible");
        showStatus("", true);
      });

      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const file = imageInput.files && imageInput.files[0];
        let image = draftImage;
        if (file) {
          try {
            image = await readImage(file);
          } catch (error) {
            showStatus(error.message, false);
            return;
          }
        }

        const wasEditing = Boolean(editingId);
        const recipe = {
          id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
          title: titleInput.value.trim(),
          ingredients: ingredientsInput.value.split("\n").map(item => item.trim()).filter(Boolean),
          instructions: instructionsInput.value.trim(),
          image: image || null
        };
        if (recipe.ingredients.length === 0) {
          showStatus("Add at least one ingredient before saving.", false);
          ingredientsInput.focus();
          return;
        }

        const nextRecipes = editingId
          ? recipes.map(item => item.id === editingId ? recipe : item)
          : [recipe, ...recipes];
        if (!saveRecipes(nextRecipes)) return;
        resetForm();
        showStatus(wasEditing ? "Recipe updated." : "Recipe added to your collection.", true);
        render();
      });

      cancelButton.addEventListener("click", resetForm);
      searchInput.addEventListener("input", render);
      document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
      document.querySelector("#dialog-done").addEventListener("click", () => dialog.close());
      document.querySelector("#dialog-edit").addEventListener("click", () => {
        const id = currentDialogId;
        dialog.close();
        if (id) startEditing(id);
      });
      dialog.addEventListener("close", () => { currentDialogId = null; });

      render();
    })();
