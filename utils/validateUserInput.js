function validateRegistrationInput({ username, password }) {
    const errors = []

    if (!username || !password) {
        errors.push("Username and password required.")
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        errors.push("Username needs to be at least 3 characters.")
    }

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
        errors.push("Password needs to be at least 6 characters.")
    }

    return errors
}

function validateLoginInput({ username, password }) {
    const errors = []

    if (!username || typeof username !== "string") {
        errors.push("Username is required.");
    } else if (username.trim().length < 3) {
        errors.push("Username must be at least 3 characters.");
    }

    if (!password || typeof password !== "string") {
        errors.push("Password is required.");
    } else if (password.trim().length === 0) {
        errors.push("Password cannot be empty.");
    }

    return errors
}

module.exports = {
    validateRegistrationInput,
    validateLoginInput,
}