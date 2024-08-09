document.addEventListener('DOMContentLoaded', () => {
    
    fetch('https://roan-neon-outrigger.glitch.me/api/current-user')
        .then(response => {
            if (!response.ok) {
                throw new Error('Not authenticated');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('username').textContent = data.username;
        })
        .catch(error => {
            console.error('Error fetching user info:', error);
            // Redirect to login page or show login prompt
        });

    // Function to check if the user is logged in
    async function checkLogin() {
        try {
            const response = await fetch('https://roan-neon-outrigger.glitch.me/api/check-session', {
                method: 'GET',
                credentials: 'include' // Important: send cookies with the request
            });

            if (!response.ok) {
                throw new Error('Not authenticated');
            }
        } catch (err) {
            window.location.href = '/login.html';
        }
    }

    // Check if user is logged in when the page loads
    checkLogin();

    // Handle the transaction form submission
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const type = document.getElementById('type').checked ? 'income' : 'expense';
            const category = document.getElementById('category').value;
            const amount = document.getElementById('amount').value;
            const date = document.getElementById('date').value;
            const statusDiv = document.getElementById('status');

            try {
                const response = await fetch('https://roan-neon-outrigger.glitch.me/api/expenses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // Important: send cookies with the request
                    body: JSON.stringify({ type, category, amount, date })
                });

                const data = await response.json();

                if (!response.ok) {
                    statusDiv.textContent = data;
                } else {
                    statusDiv.textContent = "Transaction added successfully";
                    transactionForm.reset();
                    loadTransactions(); // Refresh the transactions list
                }
            } catch (err) {
                statusDiv.textContent = err;
            }
        });
    }

    // Handle the edit expense form submission
    const editExpenseForm = document.getElementById('editExpenseForm');
    if (editExpenseForm) {
        editExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const expenseId = document.getElementById('editExpenseId').value;
            const category = document.getElementById('editCategory').value;
            const amount = document.getElementById('editAmount').value;
            const date = document.getElementById('editDate').value;
            const statusDiv = document.getElementById('status');

            try {
                const response = await fetch(`https://roan-neon-outrigger.glitch.me/api/expenses/${expenseId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // Important: send cookies with the request
                    body: JSON.stringify({ category, amount, date })
                });

                const data = await response.json();

                if (!response.ok) {
                    statusDiv.textContent = data;
                } else {
                    statusDiv.textContent = "Expense updated successfully";
                    editExpenseForm.reset();
                    document.getElementById('editExpenseFormContainer').style.display = 'none';
                    loadTransactions(); // Refresh the transactions list
                }
            } catch (err) {
                statusDiv.textContent = err;
            }
        });
    }

    // Handle expense deletion
    async function deleteTransaction(expenseId) {
        const statusDiv = document.getElementById('status');

        try {
            const response = await fetch(`https://roan-neon-outrigger.glitch.me/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Important: send cookies with the request
            });

            const data = await response.json();

            if (!response.ok) {
                statusDiv.textContent = data;
            } else {
                statusDiv.textContent = "Transaction deleted successfully";
                loadTransactions(); // Refresh the transactions list
            }
        } catch (err) {
            statusDiv.textContent = err;
        }
    }

    // Function to fetch and display transactions
    async function loadTransactions() {
        const transactionList = document.getElementById('transactionList');
        const statusDiv = document.getElementById('status');

        try {
            const response = await fetch('https://roan-neon-outrigger.glitch.me/api/expenses', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Important: send cookies with the request
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data);
            }

            transactionList.innerHTML = '';

            data.forEach(expense => {
                const listItem = document.createElement('li');
                listItem.textContent = `${expense.category}: $${expense.amount} on ${expense.date}`;

                // Add edit button
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.onclick = () => showEditForm(expense);
                listItem.appendChild(editButton);

                // Add delete button
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.onclick = () => deleteTransaction(expense.id);
                listItem.appendChild(deleteButton);

                transactionList.appendChild(listItem);
            });

        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
        }
    }

    // Function to show the edit form with existing expense data
    function showEditForm(expense) {
        document.getElementById('editExpenseId').value = expense.id;
        document.getElementById('editCategory').value = expense.category;
        document.getElementById('editAmount').value = expense.amount;
        document.getElementById('editDate').value = expense.date;
        document.getElementById('editExpenseFormContainer').style.display = 'block';
    }

    // Load transactions when the page loads
    loadTransactions();

    // Event listener for logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('https://roan-neon-outrigger.glitch.me/api/logout', {
                method: 'POST',
                credentials: 'include' // Important to send cookies with the request
            });

            if (response.ok) {
                window.location.href = 'login.html'; // Redirect to login page or home page
            } else {
                console.error('Logout failed');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });
});
