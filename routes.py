from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
import sqlite3
from typing import List, Union

router = APIRouter()

def get_db_connection():
    conn = sqlite3.connect('data.db')
    conn.row_factory = sqlite3.Row
    return conn

def remove_id_field(rows):
    return [{k: v for k, v in dict(row).items() if k != "id"} for row in rows]

def to_upper_turkish(text):
    turkish_upper = str.maketrans("iı", "İI")
    return text.translate(turkish_upper).upper()

@router.post("/TCSearch")
async def tc_search(tc: int = Form(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM identity WHERE TC = ?", (tc,))
    rows = cursor.fetchall()
    conn.close()
    if rows:
        result = remove_id_field(rows)
        gsm_info = await gsm_search(tc=tc) or None
        result[0]["GSM"] = gsm_info
        return result
    else:
        return None

@router.post("/GSMSearch")
async def gsm_search(
    tc: int = Form(None),
    gsm: str = Form(None)
) -> Union[List[str], None]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if tc:
        query = "SELECT GSM FROM phone WHERE TC = ?"
        params = [tc]
    elif gsm:
        query = "SELECT TC FROM phone WHERE GSM = ?"
        params = [to_upper_turkish(gsm)]
    else:
        raise HTTPException(status_code=400, detail="Either TC or GSM parameter must be provided")
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    if rows:
        result = list(set(str(row[0]) for row in rows))
        return result
    else:
        return None

@router.post("/FieldSearch")
async def field_search(
    name: str = Form(None),
    surname: str = Form(None),
    city: str = Form(None),
    partial_name: bool = Form(False),
    partial_surname: bool = Form(False),
    year: str = Form(None),
):
    conditions = ["1=1"]
    params = []
    def add_condition(field, value, partial):
        if partial:
            conditions.append(f"{field} LIKE ?")
            params.append(f"%{value}%")
        else:
            conditions.append(f"{field} = ?")
            params.append(value)
    if name:
        add_condition("ADI", to_upper_turkish(name), partial_name)
    if surname:
        add_condition("SOYADI", to_upper_turkish(surname), partial_surname)
    if city:
        conditions.append("NUFUSIL = ?")
        params.append(to_upper_turkish(city))
    if year:
        conditions.append("DOGUMTARIHI LIKE ?")
        params.append(f"%{year}")
    query = "SELECT * FROM identity WHERE " + " AND ".join(conditions)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    if rows:
        result = remove_id_field(rows)
        return JSONResponse(content=result, status_code=200)
    else:
        raise HTTPException(status_code=404, detail="No records found")

@router.post("/FamilySearch")
async def family_search(
    tc: int = Form(None),
    babatc: int = Form(None),
    annetc: int = Form(None)
):
    family_info = {}
    if babatc:
        family_info['father'] = await tc_search(tc=babatc)
    if annetc:
        family_info['mother'] = await tc_search(tc=annetc)
    if tc:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM identity WHERE ANNETC = ?", (tc,))
        rows = cursor.fetchall()
        if not rows:
            cursor.execute("SELECT * FROM identity WHERE BABATC = ?", (tc,))
            rows = cursor.fetchall()
        conn.close()
        if rows:
            family_info['children'] = remove_id_field(rows)
    if babatc:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM identity WHERE BABATC = ?", (babatc,))
        rows = cursor.fetchall()
        conn.close()
        if rows:
            siblings = [row for row in rows if row['TC'] != tc]
            family_info['siblings'] = remove_id_field(siblings)
    return family_info

@router.post("/AdvancedSearch")
async def advanced_search(tc: int = Form(None)):
    base_info = await tc_search(tc=tc)
    if base_info:
        baba_tc = base_info[0]["BABATC"]
        anne_tc = base_info[0]["ANNETC"]
        family_info = await family_search(tc=tc, babatc=baba_tc, annetc=anne_tc)
        base_info[0]["ANNE"] = family_info.get("mother")
        base_info[0]["BABA"] = family_info.get("father")
        base_info[0]["KARDESLER"] = family_info.get("siblings")
        base_info[0]["COCUKLAR"] = family_info.get("children")
        return JSONResponse(content=base_info, status_code=200)
    else:
        raise HTTPException(status_code=404, detail="No records found")
