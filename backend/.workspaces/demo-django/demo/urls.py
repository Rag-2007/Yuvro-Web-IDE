from django.urls import path
from django.http import HttpResponse
import sqlite3
from pathlib import Path

# A simple home view
def home(request):
    db_path = Path(__file__).resolve().parent.parent / 'db.sqlite3'
    users_data = []
    products_data = []
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email FROM users")
        users_data = [{"id": r[0], "name": r[1], "email": r[2]} for r in cursor.fetchall()]
        cursor.execute("SELECT id, title, price FROM products")
        products_data = [{"id": r[0], "title": r[1], "price": r[2]} for r in cursor.fetchall()]
        conn.close()
    except Exception as e:
        return HttpResponse(f"Error accessing DB: {str(e)}", status=500)

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Django Demo</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #0f111a;
                color: #ffffff;
                padding: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
                margin: 0;
            }}
            .container {{
                background-color: #1a1d27;
                border: 1px solid #2e3244;
                border-radius: 12px;
                padding: 30px;
                max-width: 800px;
                width: 100%;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            }}
            h1 {{
                color: #3b82f6;
                margin-top: 0;
                font-size: 2.5rem;
                text-align: center;
                background: linear-gradient(to right, #3b82f6, #60a5fa);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }}
            h2 {{
                color: #60a5fa;
                border-bottom: 1px solid #2e3244;
                padding-bottom: 8px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }}
            th, td {{
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #2e3244;
            }}
            th {{
                color: #94a3b8;
                font-weight: 600;
            }}
            tr:hover {{
                background-color: #242936;
            }}
            .badge {{
                display: inline-block;
                background-color: #10b981;
                color: #ffffff;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.85rem;
                font-weight: bold;
                text-align: center;
                margin-bottom: 20px;
            }}
            .badge-wrapper {{
                text-align: center;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Django Demo Project</h1>
            <div class="badge-wrapper">
                <span class="badge">Django Server Running</span>
            </div>
            
            <h2>Users (from db.sqlite3)</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(f"<tr><td>{u['id']}</td><td>{u['name']}</td><td>{u['email']}</td></tr>" for u in users_data)}
                </tbody>
            </table>

            <h2>Products (from db.sqlite3)</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(f"<tr><td>{p['id']}</td><td>{p['title']}</td><td>${p['price']:.2f}</td></tr>" for p in products_data)}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """
    return HttpResponse(html_content)

urlpatterns = [
    path('', home),
]
