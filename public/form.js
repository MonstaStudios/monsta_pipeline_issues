var selectedFiles = [];

/**
 * Shows or hides the custom department text input when "OTHERS..." is selected.
 * @param {Event} e - The change event from the department select element.
 */
function handleDepartmentChange(e) {
    var departmentSelect = e.target;
    var customDepartmentInput = document.getElementById('custom-department');
    if (departmentSelect.value === 'Other') {
        customDepartmentInput.classList.remove('hidden');
        customDepartmentInput.querySelector('input').required = true;
    } else {
        customDepartmentInput.classList.add('hidden');
        customDepartmentInput.querySelector('input').required = false;
    }
}

/**
 * Shows or hides the custom tool text input when "Other..." is selected.
 * @param {Event} e - The change event from the tool select element.
 */
function handleToolChange(e) {
    var toolSelect = e.target;
    var customToolInput = document.getElementById('custom-tool');
    if (toolSelect.value === 'Other') {
        customToolInput.classList.remove('hidden');
        customToolInput.querySelector('input').required = true;
    } else {
        customToolInput.classList.add('hidden');
        customToolInput.querySelector('input').required = false;
    }
}

/**
 * Re-renders the visible file list and syncs the hidden file input.
 * Uses createElement instead of innerHTML to avoid CSP violations on inline handlers.
 */
function updateFileList() {
    var fileList = document.getElementById('file-list');
    var fileCount = document.getElementById('file-count');

    fileList.innerHTML = '';

    if (selectedFiles.length === 0) {
        var emptyMessage = document.createElement('div');
        emptyMessage.style.cssText = 'color: #888; font-size: 13px; padding: 8px;';
        emptyMessage.textContent = 'No files selected';
        fileList.appendChild(emptyMessage);
        fileCount.textContent = '';
    } else {
        selectedFiles.forEach(function(file, fileIndex) {
            var fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            var fileNameSpan = document.createElement('span');
            fileNameSpan.className = 'file-name';
            fileNameSpan.textContent = file.name;

            var removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'file-remove';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', function() {
                removeFile(fileIndex);
            });

            fileItem.appendChild(fileNameSpan);
            fileItem.appendChild(removeButton);
            fileList.appendChild(fileItem);
        });
        fileCount.textContent = selectedFiles.length + ' file(s) selected';
    }

    var dataTransfer = new DataTransfer();
    selectedFiles.forEach(function(file) {
        dataTransfer.items.add(file);
    });
    document.getElementById('hidden-file-input').files = dataTransfer.files;
}

/**
 * Removes a file from the selectedFiles array by index and refreshes the list.
 * @param {number} fileIndex - The index of the file to remove.
 */
function removeFile(fileIndex) {
    selectedFiles.splice(fileIndex, 1);
    updateFileList();
}

/**
 * Appends newly selected files to selectedFiles and refreshes the list.
 * @param {HTMLInputElement} fileInput - The file input element that triggered the change.
 */
function handleFileSelect(fileInput) {
    if (fileInput.files && fileInput.files.length > 0) {
        for (var i = 0; i < fileInput.files.length; i++) {
            selectedFiles.push(fileInput.files[i]);
        }
        updateFileList();
    }
    fileInput.value = '';
}

window.addEventListener('DOMContentLoaded', function () {
    document.getElementById('department-select').addEventListener('change', handleDepartmentChange);
    document.getElementById('tool-select').addEventListener('change', handleToolChange);

    document.getElementById('add-more-btn').addEventListener('click', function() {
        document.getElementById('temp-file-input').click();
    });

    document.getElementById('temp-file-input').addEventListener('change', function() {
        handleFileSelect(this);
    });

    updateFileList();

    var form = document.querySelector('form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        grecaptcha.ready(function () {
            grecaptcha.execute('6Le5-X4sAAAAAPUtA7Vi636J9JJUQjpGceMjh3Qz', { action: 'submit' }).then(function (token) {
                document.getElementById('g-recaptcha-response').value = token;
                form.submit();
            });
        });
    });
});
